-- =============================================================================
-- ふたり質問：ユーザーごとの進行（advanced_at）+ sequence ベース進行
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schema
-- -----------------------------------------------------------------------------

ALTER TABLE daily_question_rounds
  ADD COLUMN IF NOT EXISTS sequence_number int,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE daily_question_responses
  ADD COLUMN IF NOT EXISTS advanced_at timestamptz;

-- sequence_number backfill
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY couple_id
      ORDER BY created_at ASC, id ASC
    ) AS seq
  FROM daily_question_rounds
)
UPDATE daily_question_rounds r
SET
  sequence_number = n.seq,
  started_at = COALESCE(r.started_at, r.created_at, now())
FROM numbered n
WHERE r.id = n.id
  AND r.sequence_number IS NULL;

ALTER TABLE daily_question_rounds
  ALTER COLUMN sequence_number SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL;

-- 既存 revealed 済み → ユーザーは既読扱い（案A）
UPDATE daily_question_responses resp
SET advanced_at = r.revealed_at
FROM daily_question_rounds r
WHERE resp.round_id = r.id
  AND r.revealed_at IS NOT NULL
  AND resp.advanced_at IS NULL;

ALTER TABLE daily_question_rounds
  DROP CONSTRAINT IF EXISTS daily_question_rounds_couple_date_unique;

ALTER TABLE daily_question_rounds
  DROP CONSTRAINT IF EXISTS daily_question_rounds_couple_sequence_unique;

ALTER TABLE daily_question_rounds
  ADD CONSTRAINT daily_question_rounds_couple_sequence_unique
  UNIQUE (couple_id, sequence_number);

DROP INDEX IF EXISTS idx_daily_question_rounds_couple_date;
DROP INDEX IF EXISTS idx_dqr_couple_in_progress;

CREATE INDEX idx_dqr_couple_in_progress
  ON daily_question_rounds (couple_id, sequence_number DESC)
  WHERE revealed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dqr_responses_user_unadvanced
  ON daily_question_responses (user_id, round_id)
  WHERE advanced_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pick_next_question_id(p_couple_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id
  FROM couple_questions q
  WHERE q.is_active = true
    AND q.id NOT IN (
      SELECT r.question_id
      FROM daily_question_rounds r
      WHERE r.couple_id = p_couple_id
    )
  ORDER BY q.display_order ASC, q.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_in_progress_round_id(p_couple_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id
    AND revealed_at IS NULL
  ORDER BY sequence_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_pending_revealed_round_id(
  p_couple_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM daily_question_rounds r
  JOIN daily_question_responses resp
    ON resp.round_id = r.id
   AND resp.user_id = p_user_id
  WHERE r.couple_id = p_couple_id
    AND r.revealed_at IS NOT NULL
    AND resp.advanced_at IS NULL
  ORDER BY r.sequence_number ASC
  LIMIT 1;
$$;

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
  SELECT id
  INTO v_existing
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id
    AND revealed_at IS NULL
  ORDER BY sequence_number DESC
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
-- 3. get_daily_question_state
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

  -- Step 1: 未 advance の revealed（sequence 最小）
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

  -- Step 2: 進行中 round
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

  -- Step 3 / 4: 次の質問プレビュー or 全問完了
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
-- 4. advance_daily_question_for_user
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
-- 5. submit_daily_question_answer
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
-- 6. submit_daily_question_guess
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_daily_question_guess(p_guess text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id         uuid;
  v_round_id          uuid;
  v_user_id           uuid := auth.uid();
  v_partner_user_id   uuid;
  v_trimmed           text;
  v_updated           int;
  v_partner_answer    text;
  v_partner_guess     text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  v_trimmed := trim(p_guess);
  IF char_length(v_trimmed) < 1 OR char_length(v_trimmed) > 80 THEN
    RAISE EXCEPTION 'guess length must be between 1 and 80';
  END IF;

  SELECT couple_id INTO v_couple_id FROM couple_members WHERE user_id = v_user_id LIMIT 1;
  IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  v_round_id := get_in_progress_round_id(v_couple_id);

  IF v_round_id IS NULL THEN
    RAISE EXCEPTION 'no active round';
  END IF;

  IF EXISTS (
    SELECT 1 FROM daily_question_rounds
    WHERE id = v_round_id AND revealed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'round already revealed';
  END IF;

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_user_id
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1
    FROM daily_question_responses
    WHERE round_id = v_round_id
      AND user_id = v_user_id
      AND answer IS NOT NULL
      AND guess IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot submit guess in current state';
  END IF;

  UPDATE daily_question_responses
  SET guess = v_trimmed,
      guessed_at = now()
  WHERE round_id = v_round_id
    AND user_id = v_user_id
    AND guess IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'guess already submitted';
  END IF;

  SELECT answer, guess
  INTO v_partner_answer, v_partner_guess
  FROM daily_question_responses
  WHERE round_id = v_round_id
    AND user_id = v_partner_user_id;

  IF v_partner_answer IS NOT NULL AND v_partner_guess IS NOT NULL THEN
    UPDATE daily_question_rounds
    SET revealed_at = COALESCE(revealed_at, now())
    WHERE id = v_round_id;
  END IF;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Push targets（進行中 + needs_my_answer のみ）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION list_daily_question_push_targets()
RETURNS TABLE (user_id uuid, round_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_couple_id uuid;
  v_round_id  uuid;
  v_answer    text;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT ps.user_id
    FROM push_subscriptions ps
  LOOP
    SELECT cm.couple_id
    INTO v_couple_id
    FROM couple_members cm
    WHERE cm.user_id = v_user_id
    LIMIT 1;

    IF v_couple_id IS NULL OR NOT couple_has_partner(v_couple_id) THEN
      CONTINUE;
    END IF;

    IF get_user_pending_revealed_round_id(v_couple_id, v_user_id) IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_round_id := get_in_progress_round_id(v_couple_id);
    IF v_round_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT dqr.answer
    INTO v_answer
    FROM daily_question_responses dqr
    WHERE dqr.round_id = v_round_id
      AND dqr.user_id = v_user_id;

    IF v_answer IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM daily_question_notifications dqn
      WHERE dqn.user_id = v_user_id
        AND dqn.round_id = v_round_id
        AND dqn.notification_type = 'daily_question'
    ) THEN
      CONTINUE;
    END IF;

    user_id := v_user_id;
    round_id := v_round_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Grants
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION pick_next_question_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_in_progress_round_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_user_pending_revealed_round_id(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_daily_question_round(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION advance_daily_question_for_user() TO authenticated;
