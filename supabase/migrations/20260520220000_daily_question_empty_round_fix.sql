-- =============================================================================
-- ふたり質問：空 round（response 0件）の恒久対策
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. close_stale_empty_daily_question_rounds
--    response 0件かつ、より新しい round（revealed または seq 大）が存在する
--    空 round を完了扱いにする
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION close_stale_empty_daily_question_rounds(p_couple_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed int;
BEGIN
  UPDATE daily_question_rounds r
  SET revealed_at = now()
  WHERE r.revealed_at IS NULL
    AND (p_couple_id IS NULL OR r.couple_id = p_couple_id)
    AND NOT EXISTS (
      SELECT 1
      FROM daily_question_responses resp
      WHERE resp.round_id = r.id
    )
    AND EXISTS (
      SELECT 1
      FROM daily_question_rounds newer
      WHERE newer.couple_id = r.couple_id
        AND (
          newer.revealed_at IS NOT NULL
          OR newer.sequence_number > r.sequence_number
        )
    );

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

GRANT EXECUTE ON FUNCTION close_stale_empty_daily_question_rounds(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. get_in_progress_round_id — response が1件以上ある round のみ
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_in_progress_round_id(p_couple_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM daily_question_rounds r
  WHERE r.couple_id = p_couple_id
    AND r.revealed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM daily_question_responses resp
      WHERE resp.round_id = r.id
    )
  ORDER BY r.sequence_number DESC
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 3. create_daily_question_round
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_daily_question_round(
  p_couple_id uuid,
  p_question_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing  uuid;
  v_round_id  uuid;
  v_seq       int;
  v_today     date := get_jst_today();
BEGIN
  PERFORM close_stale_empty_daily_question_rounds(p_couple_id);

  v_existing := get_in_progress_round_id(p_couple_id);
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- advance 直後など、回答待ちの空 round を再利用
  SELECT r.id
  INTO v_existing
  FROM daily_question_rounds r
  WHERE r.couple_id = p_couple_id
    AND r.revealed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM daily_question_responses resp
      WHERE resp.round_id = r.id
    )
  ORDER BY r.sequence_number DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO v_seq
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id;

  INSERT INTO daily_question_rounds (
    couple_id,
    question_id,
    sequence_number,
    started_at,
    round_date
  )
  VALUES (
    p_couple_id,
    p_question_id,
    v_seq,
    now(),
    v_today
  )
  RETURNING id INTO v_round_id;

  RETURN v_round_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. advance_daily_question_for_user（cleanup hook）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION advance_daily_question_for_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id    uuid;
  v_user_id      uuid := auth.uid();
  v_round_id     uuid;
  v_revealed_at  timestamptz;
  v_question_id  uuid;
  v_updated      int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  PERFORM close_stale_empty_daily_question_rounds(v_couple_id);

  v_round_id := get_user_pending_revealed_round_id(v_couple_id, v_user_id);

  IF v_round_id IS NULL THEN
    RETURN get_daily_question_state();
  END IF;

  SELECT revealed_at
  INTO v_revealed_at
  FROM daily_question_rounds
  WHERE id = v_round_id
    AND couple_id = v_couple_id;

  IF v_revealed_at IS NULL THEN
    RAISE EXCEPTION 'round not revealed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_user_id
      AND answer IS NOT NULL
      AND guess IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'cannot advance in current state';
  END IF;

  UPDATE daily_question_responses
  SET advanced_at = now()
  WHERE round_id = v_round_id
    AND user_id = v_user_id
    AND advanced_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN get_daily_question_state();
  END IF;

  IF get_in_progress_round_id(v_couple_id) IS NULL THEN
    v_question_id := pick_next_question_id(v_couple_id);
    IF v_question_id IS NOT NULL THEN
      PERFORM create_daily_question_round(v_couple_id, v_question_id);
    END IF;
  END IF;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. submit_daily_question_answer（cleanup hook）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_daily_question_answer(p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id   uuid;
  v_round_id    uuid;
  v_user_id     uuid := auth.uid();
  v_trimmed     text;
  v_existing    text;
  v_question_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_trimmed := trim(p_answer);
  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 80 THEN
    RAISE EXCEPTION 'answer length must be between 1 and 80';
  END IF;

  SELECT couple_id INTO v_couple_id FROM couple_members WHERE user_id = v_user_id LIMIT 1;
  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  PERFORM close_stale_empty_daily_question_rounds(v_couple_id);

  IF get_user_pending_revealed_round_id(v_couple_id, v_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'advance required before new answer';
  END IF;

  v_round_id := get_in_progress_round_id(v_couple_id);

  IF v_round_id IS NULL THEN
    v_question_id := pick_next_question_id(v_couple_id);
    IF v_question_id IS NULL THEN
      RAISE EXCEPTION 'no available question';
    END IF;
    v_round_id := create_daily_question_round(v_couple_id, v_question_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM daily_question_rounds
    WHERE id = v_round_id AND revealed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'round already revealed';
  END IF;

  SELECT answer
  INTO v_existing
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'answer already submitted';
  END IF;

  INSERT INTO daily_question_responses (round_id, user_id, answer, answered_at)
  VALUES (v_round_id, v_user_id, v_trimmed, now())
  ON CONFLICT (round_id, user_id) DO NOTHING;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. get_daily_question_state（cleanup hook）
--    ※ understanding 列は 20260520210000 適用後に同ファイルで上書き
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_daily_question_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id            uuid;
  v_round_id             uuid;
  v_question_body        text;
  v_revealed_at          timestamptz;
  v_my_user_id           uuid := auth.uid();
  v_partner_user_id      uuid;
  v_my_answer            text;
  v_my_guess             text;
  v_partner_answer       text;
  v_partner_guess        text;
  v_phase                text;
  v_next_question_id     uuid;
  v_result               jsonb;
BEGIN
  IF v_my_user_id IS NULL THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_my_user_id
  LIMIT 1;

  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RETURN jsonb_build_object('visible', false);
  END IF;

  PERFORM close_stale_empty_daily_question_rounds(v_couple_id);

  v_round_id := get_user_pending_revealed_round_id(v_couple_id, v_my_user_id);

  IF v_round_id IS NOT NULL THEN
    SELECT q.body, r.revealed_at
    INTO v_question_body, v_revealed_at
    FROM daily_question_rounds r
    JOIN couple_questions q ON q.id = r.question_id
    WHERE r.id = v_round_id;

    SELECT user_id
    INTO v_partner_user_id
    FROM couple_members
    WHERE couple_id = v_couple_id
      AND user_id <> v_my_user_id
    LIMIT 1;

    SELECT answer, guess
    INTO v_my_answer, v_my_guess
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_my_user_id;

    SELECT answer, guess
    INTO v_partner_answer, v_partner_guess
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_partner_user_id;

    PERFORM create_daily_question_timeline_event(v_round_id);

    RETURN jsonb_build_object(
      'visible', true,
      'phase', 'revealed',
      'question', v_question_body,
      'round_id', v_round_id,
      'can_advance', true,
      'my_answer', v_my_answer,
      'my_guess', v_my_guess,
      'partner_answer', v_partner_answer,
      'partner_guess', v_partner_guess,
      'revealed_at', v_revealed_at
    );
  END IF;

  v_round_id := get_in_progress_round_id(v_couple_id);

  IF v_round_id IS NOT NULL THEN
    SELECT q.body, r.revealed_at
    INTO v_question_body, v_revealed_at
    FROM daily_question_rounds r
    JOIN couple_questions q ON q.id = r.question_id
    WHERE r.id = v_round_id;

    SELECT user_id
    INTO v_partner_user_id
    FROM couple_members
    WHERE couple_id = v_couple_id
      AND user_id <> v_my_user_id
    LIMIT 1;

    SELECT answer, guess
    INTO v_my_answer, v_my_guess
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_my_user_id;

    SELECT answer, guess
    INTO v_partner_answer, v_partner_guess
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_partner_user_id;

    IF v_my_answer IS NULL THEN
      v_phase := 'needs_my_answer';
    ELSIF v_my_guess IS NULL THEN
      v_phase := 'needs_my_guess';
    ELSIF v_partner_answer IS NULL OR v_partner_guess IS NULL THEN
      v_phase := 'waiting_partner';
    ELSE
      v_phase := 'revealed';
      IF v_revealed_at IS NULL THEN
        UPDATE daily_question_rounds
        SET revealed_at = now()
        WHERE id = v_round_id
        RETURNING revealed_at INTO v_revealed_at;
      END IF;
      PERFORM create_daily_question_timeline_event(v_round_id);
    END IF;

    v_result := jsonb_build_object(
      'visible', true,
      'phase', v_phase,
      'question', v_question_body,
      'round_id', v_round_id,
      'can_advance', v_phase = 'revealed'
    );

    IF v_my_answer IS NOT NULL
       AND v_phase IN ('needs_my_guess', 'waiting_partner', 'revealed') THEN
      v_result := v_result || jsonb_build_object('my_answer', v_my_answer);
    END IF;

    IF v_phase = 'revealed' THEN
      v_result := v_result || jsonb_build_object(
        'my_guess', v_my_guess,
        'partner_answer', v_partner_answer,
        'partner_guess', v_partner_guess,
        'revealed_at', v_revealed_at
      );
    END IF;

    RETURN v_result;
  END IF;

  v_next_question_id := pick_next_question_id(v_couple_id);

  IF v_next_question_id IS NULL THEN
    RETURN jsonb_build_object(
      'visible', true,
      'phase', 'all_completed',
      'question', '',
      'round_id', null,
      'can_advance', false
    );
  END IF;

  SELECT body
  INTO v_question_body
  FROM couple_questions
  WHERE id = v_next_question_id;

  RETURN jsonb_build_object(
    'visible', true,
    'phase', 'needs_my_answer',
    'question', v_question_body,
    'round_id', null,
    'can_advance', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. デモ環境復旧 + 既存 stale empty round の一括クローズ
-- -----------------------------------------------------------------------------

UPDATE daily_question_rounds
SET revealed_at = now()
WHERE id = 'abf32b6e-66b8-47a8-ac6e-742f4f62d7c2'
  AND revealed_at IS NULL;

SELECT close_stale_empty_daily_question_rounds(NULL);
