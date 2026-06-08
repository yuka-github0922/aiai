-- =============================================================================
-- 20:00 解放制御の修正
-- - get_state と submit の判定を一致させる
-- - ユーザーごとの最終 advance round 基準で解放判定
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_last_advanced_round_id(
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
   AND resp.advanced_at IS NOT NULL
  WHERE r.couple_id = p_couple_id
  ORDER BY r.sequence_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_daily_question_unlocked_for_user(
  p_couple_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
  v_joint    timestamptz;
BEGIN
  IF NOT couple_has_advanced_any_question(p_couple_id) THEN
    RETURN true;
  END IF;

  v_round_id := get_user_last_advanced_round_id(p_couple_id, p_user_id);
  IF v_round_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT both_partners_advanced_on_round(v_round_id) THEN
    RETURN false;
  END IF;

  SELECT MAX(resp.advanced_at)
  INTO v_joint
  FROM daily_question_responses resp
  WHERE resp.round_id = v_round_id
    AND resp.advanced_at IS NOT NULL;

  IF v_joint IS NULL THEN
    RETURN false;
  END IF;

  RETURN now() >= get_next_question_unlock_at(v_joint);
END;
$$;

-- couple 全体判定は push 用に維持（ふたり advance 済みの最新 revealed 基準）
CREATE OR REPLACE FUNCTION is_daily_question_unlocked(p_couple_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_joint timestamptz;
BEGIN
  IF NOT couple_has_advanced_any_question(p_couple_id) THEN
    RETURN true;
  END IF;

  v_joint := get_couple_joint_advanced_at(p_couple_id);
  IF v_joint IS NULL THEN
    RETURN false;
  END IF;

  RETURN now() >= get_next_question_unlock_at(v_joint);
END;
$$;

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

  IF couple_has_advanced_any_question(v_couple_id)
     AND NOT is_daily_question_unlocked_for_user(v_couple_id, v_user_id) THEN
    RAISE EXCEPTION 'next question not unlocked yet';
  END IF;

  v_round_id := get_answerable_round_id(v_couple_id);

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
  v_unlock_at               timestamptz;
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
     AND user_advanced_on_round(v_user_last_advanced, v_my_user_id)
     AND NOT both_partners_advanced_on_round(v_user_last_advanced) THEN
    RETURN jsonb_build_object(
      'visible', true,
      'phase', 'waiting_next_question',
      'question', '',
      'round_id', null,
      'can_advance', false,
      'partner_pending_advance', true
    );
  END IF;

  IF v_user_last_advanced IS NOT NULL
     AND both_partners_advanced_on_round(v_user_last_advanced) THEN
    SELECT MAX(resp.advanced_at)
    INTO v_joint_advanced
    FROM daily_question_responses resp
    WHERE resp.round_id = v_user_last_advanced
      AND resp.advanced_at IS NOT NULL;

    IF v_joint_advanced IS NOT NULL THEN
      v_unlock_at := get_next_question_unlock_at(v_joint_advanced);
      IF now() < v_unlock_at THEN
        RETURN jsonb_build_object(
          'visible', true,
          'phase', 'waiting_next_question',
          'question', '',
          'round_id', null,
          'can_advance', false,
          'partner_pending_advance', false,
          'unlock_at', v_unlock_at
        );
      END IF;
    END IF;
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

    IF NOT is_daily_question_unlocked_for_user(v_couple_id, v_user_id) THEN
      CONTINUE;
    END IF;

    PERFORM ensure_unlocked_daily_question_round(v_couple_id);

    v_round_id := get_answerable_round_id(v_couple_id);
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

REVOKE ALL ON FUNCTION get_user_last_advanced_round_id(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_daily_question_unlocked_for_user(uuid, uuid) FROM PUBLIC;
