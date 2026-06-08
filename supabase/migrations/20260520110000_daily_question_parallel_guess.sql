-- 回答後すぐ予想可能 + phase 簡略化（waiting_partner へ統合）

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
    UPDATE daily_question_rounds
    SET revealed_at = COALESCE(revealed_at, now())
    WHERE id = v_round_id;
  END IF;

  RETURN get_daily_question_state();
END;
$$;
