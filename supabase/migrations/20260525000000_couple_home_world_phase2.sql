-- =============================================================================
-- ふたりの世界 Phase 2：世界の育成（continuity 付き再生成）
-- =============================================================================

ALTER TABLE couple_home_world
  ADD COLUMN IF NOT EXISTS hero_image_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_regeneration_at timestamptz;

UPDATE couple_home_world
SET hero_image_version = 1
WHERE hero_image_version IS NULL OR hero_image_version < 1;

DROP FUNCTION IF EXISTS service_claim_couple_home_world_generation(uuid);
DROP FUNCTION IF EXISTS service_upsert_couple_home_world(uuid, text, text, jsonb, uuid[], int, text, text);

-- get_couple_home_world は RETURNS TABLE の列が変わるため CREATE OR REPLACE 不可。必ず DROP してから CREATE。
DROP FUNCTION IF EXISTS public.get_couple_home_world() CASCADE;

-- -----------------------------------------------------------------------------
-- get_couple_home_world
-- -----------------------------------------------------------------------------

CREATE FUNCTION get_couple_home_world()
RETURNS TABLE (
  couple_id              uuid,
  status                 text,
  hero_image_url         text,
  hero_image_version     int,
  world_bible            jsonb,
  source_round_ids       uuid[],
  source_revealed_count  int,
  generation_phase       int,
  generated_at           timestamptz,
  last_regeneration_at   timestamptz,
  updated_at             timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT cm.couple_id
  INTO v_couple_id
  FROM couple_members cm
  WHERE cm.user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    chw.couple_id,
    chw.status,
    chw.hero_image_url,
    chw.hero_image_version,
    chw.world_bible,
    chw.source_round_ids,
    chw.source_revealed_count,
    chw.generation_phase,
    chw.generated_at,
    chw.last_regeneration_at,
    chw.updated_at
  FROM couple_home_world chw
  WHERE chw.couple_id = v_couple_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_couple_home_world() TO authenticated;

-- -----------------------------------------------------------------------------
-- service_claim_couple_home_world_generation
-- p_regrowth = true: ready 行を generating に（hero は維持）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION service_claim_couple_home_world_generation(
  p_couple_id uuid,
  p_regrowth boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_updated int := 0;
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM couple_home_world chw
    WHERE chw.couple_id = p_couple_id
      AND chw.status = 'generating'
      AND chw.updated_at >= now() - interval '5 minutes'
  ) THEN
    RETURN false;
  END IF;

  IF p_regrowth THEN
    IF NOT EXISTS (
      SELECT 1
      FROM couple_home_world chw
      WHERE chw.couple_id = p_couple_id
        AND chw.status = 'ready'
        AND chw.hero_image_url IS NOT NULL
    ) THEN
      RETURN false;
    END IF;

    UPDATE couple_home_world chw
    SET
      status = 'generating',
      updated_at = now()
    WHERE chw.couple_id = p_couple_id
      AND chw.status = 'ready';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM couple_home_world chw
    WHERE chw.couple_id = p_couple_id
      AND chw.status = 'ready'
  ) THEN
    RETURN false;
  END IF;

  UPDATE couple_home_world chw
  SET
    status = 'generating',
    updated_at = now()
  WHERE chw.couple_id = p_couple_id
    AND chw.status IN ('pending', 'failed', 'generating');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN true;
  END IF;

  INSERT INTO couple_home_world (couple_id, status)
  VALUES (p_couple_id, 'generating')
  ON CONFLICT (couple_id) DO NOTHING;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION service_claim_couple_home_world_generation(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_claim_couple_home_world_generation(uuid, boolean) TO service_role;

-- -----------------------------------------------------------------------------
-- service_upsert_couple_home_world
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION service_upsert_couple_home_world(
  p_couple_id              uuid,
  p_status                 text,
  p_hero_image_url         text DEFAULT NULL,
  p_world_bible            jsonb DEFAULT NULL,
  p_source_round_ids       uuid[] DEFAULT NULL,
  p_source_revealed_count  int DEFAULT NULL,
  p_model                  text DEFAULT NULL,
  p_last_error             text DEFAULT NULL,
  p_generation_phase       int DEFAULT NULL,
  p_hero_image_version     int DEFAULT NULL,
  p_last_regeneration_at   timestamptz DEFAULT NULL,
  p_bump_hero_version      boolean DEFAULT false,
  p_touch_regeneration     boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF p_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple_id required';
  END IF;

  IF p_status NOT IN ('pending', 'generating', 'ready', 'failed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  INSERT INTO couple_home_world (
    couple_id,
    status,
    hero_image_url,
    world_bible,
    source_round_ids,
    source_revealed_count,
    generation_phase,
    hero_image_version,
    last_error,
    model,
    generated_at,
    last_regeneration_at,
    updated_at
  )
  VALUES (
    p_couple_id,
    p_status,
    p_hero_image_url,
    COALESCE(p_world_bible, '{}'::jsonb),
    COALESCE(p_source_round_ids, '{}'),
    COALESCE(p_source_revealed_count, 0),
    COALESCE(p_generation_phase, 1),
    COALESCE(p_hero_image_version, 1),
    p_last_error,
    p_model,
    CASE WHEN p_status = 'ready' THEN now() ELSE NULL END,
    p_last_regeneration_at,
    now()
  )
  ON CONFLICT (couple_id) DO UPDATE SET
    status = EXCLUDED.status,
    hero_image_url = CASE
      WHEN p_hero_image_url IS NOT NULL THEN p_hero_image_url
      ELSE couple_home_world.hero_image_url
    END,
    world_bible = CASE
      WHEN p_world_bible IS NOT NULL THEN p_world_bible
      ELSE couple_home_world.world_bible
    END,
    source_round_ids = CASE
      WHEN p_source_round_ids IS NOT NULL THEN p_source_round_ids
      ELSE couple_home_world.source_round_ids
    END,
    source_revealed_count = CASE
      WHEN p_source_revealed_count IS NOT NULL THEN p_source_revealed_count
      ELSE couple_home_world.source_revealed_count
    END,
    generation_phase = COALESCE(p_generation_phase, couple_home_world.generation_phase),
    hero_image_version = CASE
      WHEN p_bump_hero_version THEN couple_home_world.hero_image_version + 1
      WHEN p_hero_image_version IS NOT NULL THEN p_hero_image_version
      ELSE couple_home_world.hero_image_version
    END,
    last_error = p_last_error,
    model = COALESCE(p_model, couple_home_world.model),
    generated_at = CASE
      WHEN EXCLUDED.status = 'ready' AND couple_home_world.generated_at IS NULL THEN now()
      ELSE couple_home_world.generated_at
    END,
    last_regeneration_at = CASE
      WHEN p_touch_regeneration THEN COALESCE(p_last_regeneration_at, now())
      WHEN p_last_regeneration_at IS NOT NULL THEN p_last_regeneration_at
      ELSE couple_home_world.last_regeneration_at
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION service_upsert_couple_home_world(
  uuid, text, text, jsonb, uuid[], int, text, text, int, int, timestamptz, boolean, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_upsert_couple_home_world(
  uuid, text, text, jsonb, uuid[], int, text, text, int, int, timestamptz, boolean, boolean
) TO service_role;

-- -----------------------------------------------------------------------------
-- service_restore_couple_home_world_ready（育成失敗時：前回画像を維持）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION service_restore_couple_home_world_ready(
  p_couple_id uuid,
  p_last_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  UPDATE couple_home_world chw
  SET
    status = 'ready',
    last_error = p_last_error,
    updated_at = now()
  WHERE chw.couple_id = p_couple_id
    AND chw.hero_image_url IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION service_restore_couple_home_world_ready(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_restore_couple_home_world_ready(uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- service_reset_stale_couple_home_world_generation
-- hero がある場合は ready に戻す（Phase 2）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION service_reset_stale_couple_home_world_generation(p_couple_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE couple_home_world chw
  SET
    status = CASE
      WHEN chw.hero_image_url IS NOT NULL THEN 'ready'
      ELSE 'failed'
    END,
    last_error = COALESCE(chw.last_error, 'stale_generating_reset'),
    updated_at = now()
  WHERE chw.couple_id = p_couple_id
    AND chw.status = 'generating'
    AND chw.updated_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
