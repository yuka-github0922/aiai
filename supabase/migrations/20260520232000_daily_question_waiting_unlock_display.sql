-- =============================================================================
-- waiting_next_question の表示を 20:00 基準に統一
-- 自分が「次の質問へ」済みなら、相手未確認でも unlock_at を返す
-- =============================================================================

CREATE OR REPLACE FUNCTION get_daily_question_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id               uuid;
  v_round_id                uuid;
  v_question_body           text;
  v_revealed_at             timestamptz;
  v_my_user_id              uuid := auth.uid();
  v_partner_user_id         uuid;
  v_my_answer               text;
  v_my_guess                text;
  v_partner_answer          text;
  v_partner_guess           text;
  v_phase                   text;
  v_next_question_id        uuid;
  v_result                  jsonb;
  v_user_last_advanced      uuid;
  v_joint_advanced          timestamptz;
  v_my_advanced             timestamptz;
  v_unlock_at               timestamptz;
  v_partner_pending         boolean;
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

  IF is_daily_question_unlocked_for_user(v_couple_id, v_my_user_id) THEN
    v_round_id := get_unlocked_empty_round_id(v_couple_id);
    IF v_round_id IS NOT NULL THEN
      SELECT q.body
      INTO v_question_body
      FROM daily_question_rounds r
      JOIN couple_questions q ON q.id = r.question_id
      WHERE r.id = v_round_id;

      RETURN jsonb_build_object(
        'visible', true,
        'phase', 'needs_my_answer',
        'question', v_question_body,
        'round_id', v_round_id,
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
  END IF;

  v_user_last_advanced := get_user_last_advanced_round_id(v_couple_id, v_my_user_id);

  IF v_user_last_advanced IS NOT NULL
     AND user_advanced_on_round(v_user_last_advanced, v_my_user_id) THEN
    v_partner_pending := NOT both_partners_advanced_on_round(v_user_last_advanced);

    IF v_partner_pending THEN
      SELECT resp.advanced_at
      INTO v_my_advanced
      FROM daily_question_responses resp
      WHERE resp.round_id = v_user_last_advanced
        AND resp.user_id = v_my_user_id;

      v_unlock_at := get_next_question_unlock_at(v_my_advanced);
    ELSE
      SELECT MAX(resp.advanced_at)
      INTO v_joint_advanced
      FROM daily_question_responses resp
      WHERE resp.round_id = v_user_last_advanced
        AND resp.advanced_at IS NOT NULL;

      v_unlock_at := get_next_question_unlock_at(v_joint_advanced);
    END IF;

    RETURN jsonb_build_object(
      'visible', true,
      'phase', 'waiting_next_question',
      'question', '',
      'round_id', null,
      'can_advance', false,
      'partner_pending_advance', v_partner_pending,
      'unlock_at', v_unlock_at
    );
  END IF;

  RETURN jsonb_build_object(
    'visible', true,
    'phase', 'waiting_next_question',
    'question', '',
    'round_id', null,
    'can_advance', false,
    'partner_pending_advance', false
  );
END;
$$;
