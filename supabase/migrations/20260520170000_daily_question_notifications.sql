-- =============================================================================
-- 今日のふたり質問 Push 通知
-- - 送信履歴テーブル（重複防止）
-- - cron 用 round ensure
-- - 送信対象ユーザー一覧 RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. daily_question_notifications
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_question_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id          uuid NOT NULL REFERENCES daily_question_rounds(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_question_notifications_unique
    UNIQUE (user_id, round_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_question_notifications_user_round
  ON daily_question_notifications (user_id, round_id);

-- -----------------------------------------------------------------------------
-- 2. ensure_daily_question_round_system（cron 専用）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_daily_question_round_system(p_couple_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id    uuid;
  v_question_id uuid;
  v_today       date := get_jst_today();
BEGIN
  IF NOT couple_has_partner(p_couple_id) THEN
    RETURN NULL;
  END IF;

  SELECT id
  INTO v_round_id
  FROM daily_question_rounds
  WHERE couple_id = p_couple_id
    AND round_date = v_today;

  IF v_round_id IS NOT NULL THEN
    RETURN v_round_id;
  END IF;

  SELECT id
  INTO v_question_id
  FROM couple_questions
  WHERE is_active = true
  ORDER BY display_order ASC, created_at ASC
  LIMIT 1;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO daily_question_rounds (couple_id, question_id, round_date)
  VALUES (p_couple_id, v_question_id, v_today)
  ON CONFLICT (couple_id, round_date) DO NOTHING
  RETURNING id INTO v_round_id;

  IF v_round_id IS NULL THEN
    SELECT id
    INTO v_round_id
    FROM daily_question_rounds
    WHERE couple_id = p_couple_id
      AND round_date = v_today;
  END IF;

  RETURN v_round_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. list_daily_question_push_targets（cron 専用）
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

    v_round_id := ensure_daily_question_round_system(v_couple_id);
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
-- 4. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE daily_question_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_question_notifications_select_own
  ON daily_question_notifications;
CREATE POLICY daily_question_notifications_select_own
  ON daily_question_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT は service role（API cron）からのみ

-- -----------------------------------------------------------------------------
-- 5. Grants（cron RPC は service_role のみ）
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION ensure_daily_question_round_system(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_daily_question_push_targets() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION list_daily_question_push_targets() TO service_role;

GRANT SELECT ON daily_question_notifications TO authenticated;
