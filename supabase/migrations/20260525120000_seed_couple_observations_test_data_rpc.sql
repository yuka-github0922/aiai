-- Dev/test: seed_couple_observations_test_data RPC
-- 実行: node scripts/run-seed-couple-observations-test.mjs

CREATE OR REPLACE FUNCTION seed_couple_observations_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_a        uuid;
  v_user_b        uuid;
  v_name_a        text;
  v_name_b        text;
  v_couple_id     uuid;
  v_now           timestamptz := now();
  v_notices       jsonb := '[
    {"emoji": "💬", "label": "最近は気持ちを確認したい話題が増えている"},
    {"emoji": "🏠", "label": "住まいについて具体的な話が増えている"},
    {"emoji": "🐶", "label": "ペットとの生活を想像する会話が増えてきた"}
  ]'::jsonb;
  v_source        jsonb := jsonb_build_object(
    'observations_prompt_version', 'observation_v1',
    'seed', 'couple_observations_test_v1'
  );
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

  SELECT COALESCE(NULLIF(trim(p.display_name), ''), 'あなた')
  INTO v_name_a
  FROM profiles p
  WHERE p.id = v_user_a;

  SELECT COALESCE(NULLIF(trim(p.display_name), ''), 'パートナー')
  INTO v_name_b
  FROM profiles p
  WHERE p.id = v_user_b;

  DELETE FROM partner_memos
  WHERE user_id IN (v_user_a, v_user_b)
    AND couple_id = v_couple_id;

  INSERT INTO partner_memos (user_id, couple_id, content, created_at)
  VALUES
    (v_user_a, v_couple_id, '小春は家族として大切にしている', v_now - interval '2 days'),
    (v_user_a, v_couple_id, '週末は一緒にゲームを楽しみたい', v_now - interval '1 day'),
    (v_user_a, v_couple_id, '沖縄の海に行きたい', v_now - interval '6 hours'),
    (v_user_b, v_couple_id, '焼肉デートが好き', v_now - interval '2 days'),
    (v_user_b, v_couple_id, '一緒の時間を大切にしたい', v_now - interval '1 day'),
    (v_user_b, v_couple_id, '水族館もデート先にしたい', v_now - interval '5 hours');

  INSERT INTO cached_couple_traits (
    couple_id,
    self_traits,
    partner_traits,
    generated_at,
    source_summary,
    model,
    recent_notices,
    observations_generated_at,
    observations_model,
    updated_at
  )
  VALUES (
    v_couple_id,
    jsonb_build_object(
      'user_id', v_user_a,
      'name', v_name_a,
      'traits', jsonb_build_array(
        '実家の柴犬・小春が大好き。',
        '嬉しいことも不安なことも素直に感じる、',
        '感情豊かな女の子。'
      )
    ),
    jsonb_build_object(
      'user_id', v_user_b,
      'name', v_name_b,
      'traits', jsonb_build_array(
        '将来のことを考えるのが好き。',
        '少し慎重だけど、',
        '大切な人のためには行動できる男の子。'
      )
    ),
    v_now,
    v_source || jsonb_build_object('prompt_version', 'smile_intro_v2'),
    'seed',
    v_notices,
    v_now,
    'seed',
    v_now
  )
  ON CONFLICT (couple_id) DO UPDATE SET
    recent_notices = EXCLUDED.recent_notices,
    observations_generated_at = EXCLUDED.observations_generated_at,
    observations_model = EXCLUDED.observations_model,
    source_summary = COALESCE(cached_couple_traits.source_summary, '{}'::jsonb)
      || EXCLUDED.source_summary,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'couple_id', v_couple_id,
    'user_a', v_user_a,
    'user_b', v_user_b,
    'memos_inserted', 6,
    'recent_notices', v_notices,
    'message', 'seed complete'
  );
END;
$$;

REVOKE ALL ON FUNCTION seed_couple_observations_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_couple_observations_test_data() TO service_role;
