-- Service role 用 RPC（after() / API から auth なしで生成ジョブを実行）

CREATE OR REPLACE FUNCTION service_claim_couple_home_world_generation(p_couple_id uuid)
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
      AND chw.status = 'ready'
  ) THEN
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

REVOKE ALL ON FUNCTION service_claim_couple_home_world_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_claim_couple_home_world_generation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION service_upsert_couple_home_world(
  p_couple_id              uuid,
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
    last_error,
    model,
    generated_at,
    updated_at
  )
  VALUES (
    p_couple_id,
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

REVOKE ALL ON FUNCTION service_upsert_couple_home_world(uuid, text, text, jsonb, uuid[], int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_upsert_couple_home_world(uuid, text, text, jsonb, uuid[], int, text, text) TO service_role;

-- 5分以上 generating のまま固まった行を failed に戻す（再試行可能に）
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
    status = 'failed',
    last_error = COALESCE(chw.last_error, 'stale_generating_reset'),
    updated_at = now()
  WHERE chw.couple_id = p_couple_id
    AND chw.status = 'generating'
    AND chw.updated_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION service_reset_stale_couple_home_world_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_reset_stale_couple_home_world_generation(uuid) TO service_role;
