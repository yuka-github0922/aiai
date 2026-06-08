-- =============================================================================
-- ふたり質問：20:00 JST 解放制御
-- - 開示後「次の質問へ」では即次 round を作らない
-- - ふたりが advance 済みなら、次の 20:00 JST まで待機
-- - 初回質問（一度も advance なし）は即時開始可
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_next_question_unlock_at(p_advanced_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_jst_date date;
  v_unlock   timestamptz;
BEGIN
  v_jst_date := (p_advanced_at AT TIME ZONE 'Asia/Tokyo')::date;
  v_unlock := (v_jst_date::timestamp + time '20:00:00') AT TIME ZONE 'Asia/Tokyo';

  IF p_advanced_at >= v_unlock THEN
    v_unlock := ((v_jst_date + 1)::timestamp + time '20:00:00') AT TIME ZONE 'Asia/Tokyo';
  END IF;

  RETURN v_unlock;
END;
$$;

CREATE OR REPLACE FUNCTION get_latest_revealed_round_id(p_couple_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id
    AND revealed_at IS NOT NULL
  ORDER BY sequence_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION couple_has_advanced_any_question(p_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM daily_question_responses resp
    JOIN daily_question_rounds r ON r.id = resp.round_id
    WHERE r.couple_id = p_couple_id
      AND resp.advanced_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION both_partners_advanced_on_round(p_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) = 2
  FROM couple_members cm
  JOIN daily_question_responses resp
    ON resp.round_id = p_round_id
   AND resp.user_id = cm.user_id
   AND resp.advanced_at IS NOT NULL
  WHERE cm.couple_id = (
    SELECT couple_id
    FROM daily_question_rounds
    WHERE id = p_round_id
  );
$$;

CREATE OR REPLACE FUNCTION user_advanced_on_round(p_round_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM daily_question_responses
    WHERE round_id = p_round_id
      AND user_id = p_user_id
      AND advanced_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION get_couple_joint_advanced_at(p_couple_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
  v_joint    timestamptz;
BEGIN
  v_round_id := get_latest_revealed_round_id(p_couple_id);
  IF v_round_id IS NULL OR NOT both_partners_advanced_on_round(v_round_id) THEN
    RETURN NULL;
  END IF;

  SELECT MAX(resp.advanced_at)
  INTO v_joint
  FROM daily_question_responses resp
  WHERE resp.round_id = v_round_id
    AND resp.advanced_at IS NOT NULL;

  RETURN v_joint;
END;
$$;

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

CREATE OR REPLACE FUNCTION get_unlocked_empty_round_id(p_couple_id uuid)
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
    AND NOT EXISTS (
      SELECT 1
      FROM daily_question_responses resp
      WHERE resp.round_id = r.id
    )
  ORDER BY r.sequence_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_answerable_round_id(p_couple_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
BEGIN
  v_round_id := get_in_progress_round_id(p_couple_id);
  IF v_round_id IS NOT NULL THEN
    RETURN v_round_id;
  END IF;

  IF is_daily_question_unlocked(p_couple_id) THEN
    RETURN get_unlocked_empty_round_id(p_couple_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_unlocked_daily_question_round(p_couple_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id    uuid;
  v_question_id uuid;
BEGIN
  IF NOT couple_has_partner(p_couple_id) THEN
    RETURN NULL;
  END IF;

  IF NOT is_daily_question_unlocked(p_couple_id) THEN
    RETURN NULL;
  END IF;

  IF pick_next_question_id(p_couple_id) IS NULL THEN
    RETURN NULL;
  END IF;

  v_round_id := get_answerable_round_id(p_couple_id);
  IF v_round_id IS NOT NULL THEN
    RETURN v_round_id;
  END IF;

  v_question_id := pick_next_question_id(p_couple_id);
  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN create_daily_question_round(p_couple_id, v_question_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. advance_daily_question_for_user（次 round 即時作成をやめる）
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

  RETURN get_daily_question_state();
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. submit_daily_question_answer（解放前は回答不可）
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

  IF couple_has_advanced_any_question(v_couple_id)
     AND NOT is_daily_question_unlocked(v_couple_id) THEN
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

-- -----------------------------------------------------------------------------
-- 4. get_daily_question_state（waiting_next_question フェーズ）
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
  v_latest_revealed      uuid;
  v_joint_advanced       timestamptz;
  v_unlock_at            timestamptz;
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

  -- 解放済みの空 round があれば回答可能
  IF is_daily_question_unlocked(v_couple_id) THEN
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
  END IF;

  -- 初回以外は 20:00 解放まで待機
  IF couple_has_advanced_any_question(v_couple_id) THEN
    v_latest_revealed := get_latest_revealed_round_id(v_couple_id);

    IF v_latest_revealed IS NOT NULL
       AND user_advanced_on_round(v_latest_revealed, v_my_user_id)
       AND NOT both_partners_advanced_on_round(v_latest_revealed) THEN
      RETURN jsonb_build_object(
        'visible', true,
        'phase', 'waiting_next_question',
        'question', '',
        'round_id', null,
        'can_advance', false,
        'partner_pending_advance', true
      );
    END IF;

    v_joint_advanced := get_couple_joint_advanced_at(v_couple_id);
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
-- 5. list_daily_question_push_targets（20:00 に round 準備 + 未回答へ通知）
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

REVOKE ALL ON FUNCTION get_next_question_unlock_at(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_latest_revealed_round_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION couple_has_advanced_any_question(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION both_partners_advanced_on_round(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION user_advanced_on_round(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_couple_joint_advanced_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_daily_question_unlocked(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_unlocked_empty_round_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_answerable_round_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_unlocked_daily_question_round(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION ensure_unlocked_daily_question_round(uuid) TO service_role;
