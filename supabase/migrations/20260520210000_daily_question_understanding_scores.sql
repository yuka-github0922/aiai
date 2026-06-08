-- =============================================================================
-- ふたり質問：理解度スコア保存（OpenAI / fallback）
-- =============================================================================

ALTER TABLE daily_question_rounds
  ADD COLUMN IF NOT EXISTS understanding_my_score smallint,
  ADD COLUMN IF NOT EXISTS understanding_partner_score smallint,
  ADD COLUMN IF NOT EXISTS understanding_couple_score smallint,
  ADD COLUMN IF NOT EXISTS understanding_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS understanding_model text;

ALTER TABLE daily_question_rounds
  DROP CONSTRAINT IF EXISTS daily_question_rounds_understanding_my_score_check;

ALTER TABLE daily_question_rounds
  ADD CONSTRAINT daily_question_rounds_understanding_my_score_check
  CHECK (
    understanding_my_score IS NULL
    OR understanding_my_score BETWEEN 0 AND 100
  );

ALTER TABLE daily_question_rounds
  DROP CONSTRAINT IF EXISTS daily_question_rounds_understanding_partner_score_check;

ALTER TABLE daily_question_rounds
  ADD CONSTRAINT daily_question_rounds_understanding_partner_score_check
  CHECK (
    understanding_partner_score IS NULL
    OR understanding_partner_score BETWEEN 0 AND 100
  );

ALTER TABLE daily_question_rounds
  DROP CONSTRAINT IF EXISTS daily_question_rounds_understanding_couple_score_check;

ALTER TABLE daily_question_rounds
  ADD CONSTRAINT daily_question_rounds_understanding_couple_score_check
  CHECK (
    understanding_couple_score IS NULL
    OR understanding_couple_score BETWEEN 0 AND 100
  );

-- -----------------------------------------------------------------------------
-- persist_round_understanding_scores（idempotent）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION persist_round_understanding_scores(
  p_round_id uuid,
  p_my_score smallint,
  p_partner_score smallint,
  p_couple_score smallint,
  p_model text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_couple_id    uuid;
  v_round_couple uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  SELECT couple_id
  INTO v_round_couple
  FROM daily_question_rounds
  WHERE id = p_round_id
    AND revealed_at IS NOT NULL;

  IF v_round_couple IS NULL OR v_round_couple <> v_couple_id THEN
    RAISE EXCEPTION 'round not found or not revealed';
  END IF;

  UPDATE daily_question_rounds
  SET
    understanding_my_score = p_my_score,
    understanding_partner_score = p_partner_score,
    understanding_couple_score = p_couple_score,
    understanding_scored_at = now(),
    understanding_model = p_model
  WHERE id = p_round_id
    AND understanding_scored_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION persist_round_understanding_scores(
  uuid, smallint, smallint, smallint, text
) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_daily_question_state（理解度フィールド追加）
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
  v_u_my                 smallint;
  v_u_partner            smallint;
  v_u_couple             smallint;
  v_u_model              text;
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

  v_round_id := get_user_pending_revealed_round_id(v_couple_id, v_my_user_id);

  IF v_round_id IS NOT NULL THEN
    SELECT
      q.body,
      r.revealed_at,
      r.understanding_my_score,
      r.understanding_partner_score,
      r.understanding_couple_score,
      r.understanding_model
    INTO
      v_question_body,
      v_revealed_at,
      v_u_my,
      v_u_partner,
      v_u_couple,
      v_u_model
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

    v_result := jsonb_build_object(
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

    IF v_u_couple IS NOT NULL THEN
      v_result := v_result || jsonb_build_object(
        'understanding_my_score', v_u_my,
        'understanding_partner_score', v_u_partner,
        'understanding_couple_score', v_u_couple,
        'understanding_model', v_u_model
      );
    END IF;

    RETURN v_result;
  END IF;

  v_round_id := get_in_progress_round_id(v_couple_id);

  IF v_round_id IS NOT NULL THEN
    SELECT
      q.body,
      r.revealed_at,
      r.understanding_my_score,
      r.understanding_partner_score,
      r.understanding_couple_score,
      r.understanding_model
    INTO
      v_question_body,
      v_revealed_at,
      v_u_my,
      v_u_partner,
      v_u_couple,
      v_u_model
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

      IF v_u_couple IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(
          'understanding_my_score', v_u_my,
          'understanding_partner_score', v_u_partner,
          'understanding_couple_score', v_u_couple,
          'understanding_model', v_u_model
        );
      END IF;
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
-- get_daily_question_round_detail（理解度フィールド追加）
-- -----------------------------------------------------------------------------

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
  v_u_my             smallint;
  v_u_partner        smallint;
  v_u_couple         smallint;
  v_u_model          text;
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

  SELECT
    r.couple_id,
    r.revealed_at,
    q.body,
    r.understanding_my_score,
    r.understanding_partner_score,
    r.understanding_couple_score,
    r.understanding_model
  INTO
    v_round_couple_id,
    v_revealed_at,
    v_question_body,
    v_u_my,
    v_u_partner,
    v_u_couple,
    v_u_model
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
    'revealed_at', v_revealed_at,
    'understanding_my_score', v_u_my,
    'understanding_partner_score', v_u_partner,
    'understanding_couple_score', v_u_couple,
    'understanding_model', v_u_model
  );
END;
$$;
