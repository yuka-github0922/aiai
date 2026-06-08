-- =============================================================================
-- 今日のふたり質問：開示時に timeline_events を生成
-- =============================================================================

CREATE TABLE IF NOT EXISTS timeline_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id    uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  source_type  text NOT NULL,
  source_ref   uuid NOT NULL,
  title        text NOT NULL,
  body         text,
  occurred_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timeline_events_source_unique UNIQUE (source_type, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_couple_occurred
  ON timeline_events (couple_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(p.display_name), ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'メンバー'
  )
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE u.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION create_daily_question_timeline_event(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id     uuid;
  v_question      text;
  v_revealed_at   timestamptz;
  v_title         text;
  v_body          text;
  v_member        record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM timeline_events
    WHERE source_type = 'daily_question_round'
      AND source_ref = p_round_id
  ) THEN
    RETURN;
  END IF;

  SELECT r.couple_id, q.body, r.revealed_at
  INTO v_couple_id, v_question, v_revealed_at
  FROM daily_question_rounds r
  JOIN couple_questions q ON q.id = r.question_id
  WHERE r.id = p_round_id
    AND r.revealed_at IS NOT NULL;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  v_title := to_char(
    v_revealed_at AT TIME ZONE 'Asia/Tokyo',
    'FMMM"月"FMDD"日"'
  ) || 'に「' || v_question || '」に答えました';

  v_body := '質問：' || E'\n' || v_question || E'\n\n';

  FOR v_member IN
    SELECT
      cm.user_id,
      resolve_user_display_name(cm.user_id) AS display_name,
      resp.answer
    FROM couple_members cm
    JOIN daily_question_responses resp
      ON resp.round_id = p_round_id
     AND resp.user_id = cm.user_id
    WHERE cm.couple_id = v_couple_id
      AND resp.answer IS NOT NULL
    ORDER BY cm.joined_at ASC, cm.user_id ASC
  LOOP
    v_body := v_body
      || v_member.display_name || '：' || E'\n'
      || v_member.answer || E'\n\n';
  END LOOP;

  INSERT INTO timeline_events (
    couple_id,
    source_type,
    source_ref,
    title,
    body,
    occurred_at
  )
  VALUES (
    v_couple_id,
    'daily_question_round',
    p_round_id,
    v_title,
    trim(v_body),
    v_revealed_at
  )
  ON CONFLICT (source_type, source_ref) DO NOTHING;
END;
$$;

-- -----------------------------------------------------------------------------
-- Reveal 時に timeline 生成（get_daily_question_state）
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

  v_round_id := ensure_daily_question_round(v_couple_id);

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
    'round_id', v_round_id
  );

  IF v_my_answer IS NOT NULL AND v_phase IN ('needs_my_guess', 'waiting_partner', 'revealed') THEN
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
END;
$$;

-- -----------------------------------------------------------------------------
-- Reveal 時に timeline 生成（submit_daily_question_guess）
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
  v_was_revealed      boolean;
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

  v_round_id := ensure_daily_question_round(v_couple_id);

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
    SELECT revealed_at IS NOT NULL
    INTO v_was_revealed
    FROM daily_question_rounds
    WHERE id = v_round_id;

    UPDATE daily_question_rounds
    SET revealed_at = COALESCE(revealed_at, now())
    WHERE id = v_round_id;

    IF NOT v_was_revealed THEN
      PERFORM create_daily_question_timeline_event(v_round_id);
    END IF;
  END IF;

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timeline_events_select_own_couple ON timeline_events;
CREATE POLICY timeline_events_select_own_couple
  ON timeline_events
  FOR SELECT
  TO authenticated
  USING (
    couple_id IN (
      SELECT couple_id
      FROM couple_members
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON timeline_events TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_user_display_name(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_daily_question_timeline_event(uuid) TO authenticated;
