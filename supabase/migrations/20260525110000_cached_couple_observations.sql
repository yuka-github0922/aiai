-- =============================================================================
-- ふたりタブ「気づいたこと」: AI 観察レポートのキャッシュ
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_cached_couple_traits() CASCADE;

ALTER TABLE cached_couple_traits
  ADD COLUMN IF NOT EXISTS recent_notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS observations_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS observations_model text;

-- -----------------------------------------------------------------------------
-- get_cached_couple_traits（recent_notices 列を追加）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_cached_couple_traits()
RETURNS TABLE (
  couple_id                  uuid,
  self_traits                jsonb,
  partner_traits             jsonb,
  generated_at               timestamptz,
  source_summary             jsonb,
  model                      text,
  recent_notices             jsonb,
  observations_generated_at  timestamptz,
  observations_model         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.couple_id,
    c.self_traits,
    c.partner_traits,
    c.generated_at,
    c.source_summary,
    c.model,
    COALESCE(c.recent_notices, '[]'::jsonb),
    c.observations_generated_at,
    c.observations_model
  FROM cached_couple_traits c
  WHERE c.couple_id = v_couple_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cached_couple_traits() TO authenticated;

-- -----------------------------------------------------------------------------
-- upsert_cached_couple_observations（観察レポートのみ更新）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_cached_couple_observations(
  p_recent_notices    jsonb,
  p_source_summary    jsonb DEFAULT NULL,
  p_observations_model text DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  UPDATE cached_couple_traits
  SET
    recent_notices = COALESCE(p_recent_notices, '[]'::jsonb),
    observations_generated_at = now(),
    observations_model = p_observations_model,
    source_summary = CASE
      WHEN p_source_summary IS NULL THEN source_summary
      ELSE COALESCE(source_summary, '{}'::jsonb) || p_source_summary
    END,
    updated_at = now()
  WHERE couple_id = v_couple_id;

  IF NOT FOUND THEN
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
        'user_id', v_uid,
        'name', 'あなた',
        'traits', jsonb_build_array('相談を重ねるほど', 'ここにあなたらしさが', '紹介されていきます。')
      ),
      NULL,
      now(),
      COALESCE(p_source_summary, '{}'::jsonb),
      'placeholder',
      COALESCE(p_recent_notices, '[]'::jsonb),
      now(),
      p_observations_model,
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_cached_couple_observations(jsonb, jsonb, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_couple_memos_for_traits（メンバーごとの partner_memos）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_couple_memos_for_traits(p_limit_per_member int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
  v_result    jsonb := '[]'::jsonb;
  v_member    record;
  v_memos     jsonb;
  v_limit     int := GREATEST(COALESCE(p_limit_per_member, 10), 0);
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'authentication required');
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_member IN
    SELECT cm.user_id, cm.joined_at, p.display_name
    FROM couple_members cm
    LEFT JOIN profiles p ON p.id = cm.user_id
    WHERE cm.couple_id = v_couple_id
    ORDER BY cm.joined_at ASC, cm.user_id ASC
  LOOP
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'content', pm.content,
          'created_at', pm.created_at
        )
        ORDER BY pm.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_memos
    FROM (
      SELECT content, created_at
      FROM partner_memos
      WHERE user_id = v_member.user_id
      ORDER BY created_at DESC
      LIMIT v_limit
    ) pm;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_member.user_id,
        'display_name', v_member.display_name,
        'memos', v_memos
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_couple_memos_for_traits(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
