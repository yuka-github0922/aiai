-- ふたり質問の回答・round 関連データをすべて削除（質問バンクは残す）
-- Supabase SQL Editor で実行

CREATE OR REPLACE FUNCTION reset_daily_question_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notifications int;
  v_timeline      int;
  v_responses     int;
  v_rounds        int;
BEGIN
  DELETE FROM daily_question_notifications;
  GET DIAGNOSTICS v_notifications = ROW_COUNT;

  DELETE FROM timeline_events WHERE source_type = 'daily_question_round';
  GET DIAGNOSTICS v_timeline = ROW_COUNT;

  DELETE FROM daily_question_responses;
  GET DIAGNOSTICS v_responses = ROW_COUNT;

  DELETE FROM daily_question_rounds;
  GET DIAGNOSTICS v_rounds = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_notifications', v_notifications,
    'deleted_timeline_events', v_timeline,
    'deleted_responses', v_responses,
    'deleted_rounds', v_rounds
  );
END;
$$;

REVOKE ALL ON FUNCTION reset_daily_question_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_daily_question_data() TO service_role;

SELECT reset_daily_question_data();
