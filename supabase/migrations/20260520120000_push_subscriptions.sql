-- =============================================================================
-- AiAi Push 通知 subscription 保存
-- - 1ユーザー複数端末（endpoint 単位で upsert）
-- - 書き込みは本人のみ（RLS）
-- - 将来の通知オフ用に DELETE policy も用意
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- 2. updated_at trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_push_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION touch_push_subscription_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
