-- Fix: RETURNS TABLE の couple_id が PL/pgSQL 変数と衝突する (42702)

CREATE OR REPLACE FUNCTION get_couple_home_world()
RETURNS TABLE (
  couple_id              uuid,
  status                 text,
  hero_image_url         text,
  world_bible            jsonb,
  source_round_ids       uuid[],
  source_revealed_count  int,
  generation_phase       int,
  generated_at           timestamptz,
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
    chw.world_bible,
    chw.source_round_ids,
    chw.source_revealed_count,
    chw.generation_phase,
    chw.generated_at,
    chw.updated_at
  FROM couple_home_world chw
  WHERE chw.couple_id = v_couple_id;
END;
$$;

CREATE OR REPLACE FUNCTION claim_couple_home_world_generation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid       uuid := auth.uid();
  v_couple_id uuid;
  v_updated   int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT cm.couple_id
  INTO v_couple_id
  FROM couple_members cm
  WHERE cm.user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM couple_home_world chw
    WHERE chw.couple_id = v_couple_id
      AND chw.status = 'ready'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM couple_home_world chw
    WHERE chw.couple_id = v_couple_id
      AND chw.status = 'generating'
      AND chw.updated_at >= now() - interval '5 minutes'
  ) THEN
    RETURN false;
  END IF;

  UPDATE couple_home_world chw
  SET
    status = 'generating',
    updated_at = now()
  WHERE chw.couple_id = v_couple_id
    AND chw.status IN ('pending', 'failed', 'generating');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN true;
  END IF;

  INSERT INTO couple_home_world (couple_id, status)
  VALUES (v_couple_id, 'generating')
  ON CONFLICT (couple_id) DO NOTHING;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_couple_home_world(
  p_status                 text,
  p_hero_image_url         text DEFAULT NULL,
  p_world_bible            jsonb DEFAULT '{}'::jsonb,
  p_source_round_ids       uuid[] DEFAULT '{}',
  p_source_revealed_count  int DEFAULT 0,
  p_model                  text DEFAULT NULL,
  p_last_error             text DEFAULT NULL
)
RETURNS void
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

  IF p_status NOT IN ('pending', 'generating', 'ready', 'failed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT cm.couple_id
  INTO v_couple_id
  FROM couple_members cm
  WHERE cm.user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  INSERT INTO couple_home_world (
    couple_id,
    status,
    hero_image_url,
    world_bible,
    source_round_ids,
    source_revealed_count,
    generation_phase,
    last_error,
    model,
    generated_at,
    updated_at
  )
  VALUES (
    v_couple_id,
    p_status,
    p_hero_image_url,
    COALESCE(p_world_bible, '{}'::jsonb),
    COALESCE(p_source_round_ids, '{}'),
    COALESCE(p_source_revealed_count, 0),
    1,
    p_last_error,
    p_model,
    CASE WHEN p_status = 'ready' THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (couple_id) DO UPDATE SET
    status = EXCLUDED.status,
    hero_image_url = COALESCE(EXCLUDED.hero_image_url, couple_home_world.hero_image_url),
    world_bible = CASE
      WHEN EXCLUDED.status = 'ready' THEN EXCLUDED.world_bible
      ELSE couple_home_world.world_bible
    END,
    source_round_ids = CASE
      WHEN EXCLUDED.status = 'ready' THEN EXCLUDED.source_round_ids
      ELSE couple_home_world.source_round_ids
    END,
    source_revealed_count = CASE
      WHEN EXCLUDED.status = 'ready' THEN EXCLUDED.source_revealed_count
      ELSE couple_home_world.source_revealed_count
    END,
    last_error = EXCLUDED.last_error,
    model = COALESCE(EXCLUDED.model, couple_home_world.model),
    generated_at = CASE
      WHEN EXCLUDED.status = 'ready' THEN now()
      ELSE couple_home_world.generated_at
    END,
    updated_at = now();
END;
$$;
