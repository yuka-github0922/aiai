-- =============================================================================
-- ふたりの世界 Phase 1 テストデータ
-- テストカップル: aoyk.ooiooi@gmail.com × meiyuegaoshan@gmail.com
-- ゲーム · 焼肉 · 海 の3問（開示済み）
--
-- Supabase SQL Editor で実行してください。
-- =============================================================================

CREATE OR REPLACE FUNCTION seed_couple_home_world_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_a        uuid;
  v_user_b        uuid;
  v_couple_id     uuid;
  v_round_id      uuid;
  v_now           timestamptz := now();
  v_today         date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  v_round_ids     uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT id INTO v_user_a FROM auth.users WHERE email = 'aoyk.ooiooi@gmail.com' LIMIT 1;
  SELECT id INTO v_user_b FROM auth.users WHERE email = 'meiyuegaoshan@gmail.com' LIMIT 1;

  IF v_user_a IS NULL OR v_user_b IS NULL THEN
    RAISE EXCEPTION 'test users not found (aoyk.ooiooi@gmail.com / meiyuegaoshan@gmail.com)';
  END IF;

  SELECT cm1.couple_id
  INTO v_couple_id
  FROM couple_members cm1
  JOIN couple_members cm2 ON cm2.couple_id = cm1.couple_id
  WHERE cm1.user_id = v_user_a
    AND cm2.user_id = v_user_b
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'test users are not in the same couple';
  END IF;

  -- このカップルのふたり質問・世界キャッシュをリセット
  DELETE FROM daily_question_notifications
  WHERE round_id IN (
    SELECT id FROM daily_question_rounds WHERE couple_id = v_couple_id
  );

  DELETE FROM timeline_events
  WHERE couple_id = v_couple_id
    AND source_type = 'daily_question_round';

  DELETE FROM daily_question_responses
  WHERE round_id IN (
    SELECT id FROM daily_question_rounds WHERE couple_id = v_couple_id
  );

  DELETE FROM daily_question_rounds
  WHERE couple_id = v_couple_id;

  DELETE FROM couple_home_world
  WHERE couple_id = v_couple_id;

  -- Round 1: ゲーム
  INSERT INTO daily_question_rounds (
    couple_id,
    question_id,
    sequence_number,
    started_at,
    round_date,
    revealed_at
  )
  VALUES (
    v_couple_id,
    'b0000000-0000-4000-a000-000000000004',
    1,
    v_now - interval '3 days',
    v_today - 3,
    v_now - interval '3 days'
  )
  RETURNING id INTO v_round_id;

  v_round_ids := array_append(v_round_ids, v_round_id);

  INSERT INTO daily_question_responses (round_id, user_id, answer, guess, answered_at, guessed_at, advanced_at)
  VALUES
    (v_round_id, v_user_a, 'ゼルダの伝説', 'ゲーム', v_now - interval '3 days', v_now - interval '3 days', v_now - interval '3 days'),
    (v_round_id, v_user_b, '週末は一緒にゲーム', 'ゼルダ', v_now - interval '3 days', v_now - interval '3 days', v_now - interval '3 days');

  -- Round 2: 焼肉
  INSERT INTO daily_question_rounds (
    couple_id,
    question_id,
    sequence_number,
    started_at,
    round_date,
    revealed_at
  )
  VALUES (
    v_couple_id,
    'b0000000-0000-4000-a000-000000000008',
    2,
    v_now - interval '2 days',
    v_today - 2,
    v_now - interval '2 days'
  )
  RETURNING id INTO v_round_id;

  v_round_ids := array_append(v_round_ids, v_round_id);

  INSERT INTO daily_question_responses (round_id, user_id, answer, guess, answered_at, guessed_at, advanced_at)
  VALUES
    (v_round_id, v_user_a, '焼肉きんぐ', '焼肉', v_now - interval '2 days', v_now - interval '2 days', v_now - interval '2 days'),
    (v_round_id, v_user_b, 'カルビとタン', '焼肉きんぐ', v_now - interval '2 days', v_now - interval '2 days', v_now - interval '2 days');

  -- Round 3: 海
  INSERT INTO daily_question_rounds (
    couple_id,
    question_id,
    sequence_number,
    started_at,
    round_date,
    revealed_at
  )
  VALUES (
    v_couple_id,
    'b0000000-0000-4000-a000-000000000021',
    3,
    v_now - interval '1 day',
    v_today - 1,
    v_now - interval '1 day'
  )
  RETURNING id INTO v_round_id;

  v_round_ids := array_append(v_round_ids, v_round_id);

  INSERT INTO daily_question_responses (round_id, user_id, answer, guess, answered_at, guessed_at, advanced_at)
  VALUES
    (v_round_id, v_user_a, '海！沖縄行きたい', '海', v_now - interval '1 day', v_now - interval '1 day', v_now - interval '1 day'),
    (v_round_id, v_user_b, '水族館も好き', '海', v_now - interval '1 day', v_now - interval '1 day', v_now - interval '1 day');

  RETURN jsonb_build_object(
    'couple_id', v_couple_id,
    'user_a', v_user_a,
    'user_b', v_user_b,
    'revealed_rounds', 3,
    'round_ids', to_jsonb(v_round_ids),
    'message', 'seed complete — open /home twice (1st: placeholder + background gen, 2nd: hero image)'
  );
END;
$$;

REVOKE ALL ON FUNCTION seed_couple_home_world_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_couple_home_world_test_data() TO service_role;

SELECT seed_couple_home_world_test_data();
