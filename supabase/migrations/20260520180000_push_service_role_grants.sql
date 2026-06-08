-- cron（service_role）から push_subscriptions / daily_question_notifications を操作できるようにする
-- service_role は RLS をバイパスするが、テーブル GRANT は別途必要

GRANT SELECT, DELETE ON push_subscriptions TO service_role;

GRANT INSERT ON daily_question_notifications TO service_role;
