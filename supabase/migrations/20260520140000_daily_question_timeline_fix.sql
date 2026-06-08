-- 開示済みなのに timeline_events が無いケースを修復

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
    -- 開示済みなら毎回 idempotent に生成を試みる（migration 前の round も救済）
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

-- 既存の開示済み round を一括バックフィル
DO $$
DECLARE
  v_round_id uuid;
BEGIN
  FOR v_round_id IN
    SELECT id FROM daily_question_rounds WHERE revealed_at IS NOT NULL
  LOOP
    PERFORM create_daily_question_timeline_event(v_round_id);
  END LOOP;
END $$;
