-- 相談AI用：直近の開示済みふたり質問をまとめて返す

CREATE OR REPLACE FUNCTION get_recent_daily_question_rounds_for_chat(p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_user_id      uuid := auth.uid();
  v_couple_id       uuid;
  v_partner_user_id uuid;
  v_result          jsonb := '[]'::jsonb;
  v_round           record;
  v_my_answer       text;
  v_my_guess        text;
  v_partner_answer  text;
  v_partner_guess   text;
  v_limit           int := GREATEST(COALESCE(p_limit, 5), 0);
BEGIN
  IF v_my_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'authentication required');
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_my_user_id
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_my_user_id
  LIMIT 1;

  IF v_partner_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_round IN
    SELECT
      r.id AS round_id,
      r.revealed_at,
      q.body AS question_body,
      r.understanding_my_score,
      r.understanding_partner_score,
      r.understanding_couple_score,
      r.understanding_model
    FROM daily_question_rounds r
    JOIN couple_questions q ON q.id = r.question_id
    WHERE r.couple_id = v_couple_id
      AND r.revealed_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM daily_question_responses dr
        WHERE dr.round_id = r.id
          AND dr.user_id = v_my_user_id
          AND dr.answer IS NOT NULL
          AND dr.guess IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM daily_question_responses dr
        WHERE dr.round_id = r.id
          AND dr.user_id = v_partner_user_id
          AND dr.answer IS NOT NULL
          AND dr.guess IS NOT NULL
      )
    ORDER BY r.revealed_at DESC
    LIMIT v_limit
  LOOP
    SELECT answer, guess
    INTO v_my_answer, v_my_guess
    FROM daily_question_responses
    WHERE round_id = v_round.round_id
      AND user_id = v_my_user_id;

    SELECT answer, guess
    INTO v_partner_answer, v_partner_guess
    FROM daily_question_responses
    WHERE round_id = v_round.round_id
      AND user_id = v_partner_user_id;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'question', v_round.question_body,
        'round_id', v_round.round_id,
        'my_answer', v_my_answer,
        'my_guess', v_my_guess,
        'partner_answer', v_partner_answer,
        'partner_guess', v_partner_guess,
        'revealed_at', v_round.revealed_at,
        'understanding_my_score', v_round.understanding_my_score,
        'understanding_partner_score', v_round.understanding_partner_score,
        'understanding_couple_score', v_round.understanding_couple_score,
        'understanding_model', v_round.understanding_model
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_daily_question_rounds_for_chat(int) TO authenticated;
