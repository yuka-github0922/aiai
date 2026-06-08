-- きろくタイムラインから過去ラウンドの開示内容を取得

CREATE OR REPLACE FUNCTION get_daily_question_round_detail(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_user_id       uuid := auth.uid();
  v_couple_id        uuid;
  v_round_couple_id  uuid;
  v_revealed_at      timestamptz;
  v_question_body    text;
  v_partner_user_id  uuid;
  v_my_answer        text;
  v_my_guess         text;
  v_partner_answer   text;
  v_partner_guess    text;
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
    RETURN jsonb_build_object('error', 'couple not found');
  END IF;

  SELECT r.couple_id, r.revealed_at, q.body
  INTO v_round_couple_id, v_revealed_at, v_question_body
  FROM daily_question_rounds r
  JOIN couple_questions q ON q.id = r.question_id
  WHERE r.id = p_round_id;

  IF v_round_couple_id IS NULL OR v_round_couple_id <> v_couple_id THEN
    RETURN jsonb_build_object('error', 'round not found');
  END IF;

  IF v_revealed_at IS NULL THEN
    RETURN jsonb_build_object('error', 'not revealed');
  END IF;

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_my_user_id
  LIMIT 1;

  SELECT answer, guess
  INTO v_my_answer, v_my_guess
  FROM daily_question_responses
  WHERE round_id = p_round_id
    AND user_id = v_my_user_id;

  SELECT answer, guess
  INTO v_partner_answer, v_partner_guess
  FROM daily_question_responses
  WHERE round_id = p_round_id
    AND user_id = v_partner_user_id;

  IF v_my_answer IS NULL OR v_my_guess IS NULL
     OR v_partner_answer IS NULL OR v_partner_guess IS NULL THEN
    RETURN jsonb_build_object('error', 'incomplete');
  END IF;

  RETURN jsonb_build_object(
    'question', v_question_body,
    'round_id', p_round_id,
    'my_answer', v_my_answer,
    'my_guess', v_my_guess,
    'partner_answer', v_partner_answer,
    'partner_guess', v_partner_guess,
    'revealed_at', v_revealed_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_daily_question_round_detail(uuid) TO authenticated;
