-- timeline_events.title を「完了日時に答えました」形式に統一

CREATE OR REPLACE FUNCTION create_daily_question_timeline_event(p_round_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id     uuid;
  v_question      text;
  v_revealed_at   timestamptz;
  v_title         text;
  v_body          text;
  v_member        record;
  v_when_jst      text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM timeline_events
    WHERE source_type = 'daily_question_round'
      AND source_ref = p_round_id
  ) THEN
    RETURN;
  END IF;

  SELECT r.couple_id, q.body, r.revealed_at
  INTO v_couple_id, v_question, v_revealed_at
  FROM daily_question_rounds r
  JOIN couple_questions q ON q.id = r.question_id
  WHERE r.id = p_round_id
    AND r.revealed_at IS NOT NULL;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  v_when_jst := to_char(
    v_revealed_at AT TIME ZONE 'Asia/Tokyo',
    'FMMM"月"FMDD"日"'
  );
  v_title := v_when_jst || 'に「' || v_question || '」に答えました';

  v_body := '質問：' || E'\n' || v_question || E'\n\n';

  FOR v_member IN
    SELECT
      cm.user_id,
      resolve_user_display_name(cm.user_id) AS display_name,
      resp.answer
    FROM couple_members cm
    JOIN daily_question_responses resp
      ON resp.round_id = p_round_id
     AND resp.user_id = cm.user_id
    WHERE cm.couple_id = v_couple_id
      AND resp.answer IS NOT NULL
    ORDER BY cm.joined_at ASC, cm.user_id ASC
  LOOP
    v_body := v_body
      || v_member.display_name || '：' || E'\n'
      || v_member.answer || E'\n\n';
  END LOOP;

  INSERT INTO timeline_events (
    couple_id,
    source_type,
    source_ref,
    title,
    body,
    occurred_at
  )
  VALUES (
    v_couple_id,
    'daily_question_round',
    p_round_id,
    v_title,
    trim(v_body),
    v_revealed_at
  )
  ON CONFLICT (source_type, source_ref) DO NOTHING;
END;
$$;

-- 既存イベントの title を更新
UPDATE timeline_events te
SET title = to_char(
      r.revealed_at AT TIME ZONE 'Asia/Tokyo',
      'FMMM"月"FMDD"日"'
    )
    || 'に「'
    || q.body
    || '」に答えました'
FROM daily_question_rounds r
JOIN couple_questions q ON q.id = r.question_id
WHERE te.source_type = 'daily_question_round'
  AND te.source_ref = r.id
  AND r.revealed_at IS NOT NULL;
