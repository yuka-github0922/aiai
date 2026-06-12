-- =============================================================================
-- ふたりの世界：ホーム Art Direction キャッシュ（Phase 1）
-- =============================================================================

CREATE TABLE IF NOT EXISTS couple_home_world (
  couple_id              uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  status                 text NOT NULL DEFAULT 'pending',
  hero_image_url         text,
  world_bible            jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_round_ids       uuid[] NOT NULL DEFAULT '{}',
  source_revealed_count  int NOT NULL DEFAULT 0,
  generation_phase       int NOT NULL DEFAULT 1,
  last_error             text,
  model                  text,
  generated_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT couple_home_world_status_check CHECK (
    status IN ('pending', 'generating', 'ready', 'failed')
  )
);

ALTER TABLE couple_home_world ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON couple_home_world FROM anon;
GRANT SELECT ON couple_home_world TO authenticated;

CREATE POLICY couple_home_world_select_member
  ON couple_home_world
  FOR SELECT
  TO authenticated
  USING (
    couple_id IN (
      SELECT couple_id
      FROM couple_members
      WHERE user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- get_revealed_daily_question_count
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_revealed_daily_question_count()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid               uuid := auth.uid();
  v_couple_id         uuid;
  v_partner_user_id   uuid;
  v_count             int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT user_id
  INTO v_partner_user_id
  FROM couple_members
  WHERE couple_id = v_couple_id
    AND user_id <> v_uid
  LIMIT 1;

  IF v_partner_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM daily_question_rounds r
  WHERE r.couple_id = v_couple_id
    AND r.revealed_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM daily_question_responses dr
      WHERE dr.round_id = r.id
        AND dr.user_id = v_uid
        AND dr.answer IS NOT NULL
        AND dr.guess IS NOT NULL
    )
    AND EXISTS (
      SELECT 1
      FROM daily_question_responses dr
      WHERE dr.round_id = r.id
        AND dr.user_id = v_partner_user_id
        AND dr.answer IS NOT NULL
        AND dr.guess IS NOT NULL
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION get_revealed_daily_question_count() TO authenticated;

-- -----------------------------------------------------------------------------
-- get_couple_home_world
-- -----------------------------------------------------------------------------

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

GRANT EXECUTE ON FUNCTION get_couple_home_world() TO authenticated;

-- -----------------------------------------------------------------------------
-- claim_couple_home_world_generation
-- -----------------------------------------------------------------------------

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

GRANT EXECUTE ON FUNCTION claim_couple_home_world_generation() TO authenticated;

-- -----------------------------------------------------------------------------
-- upsert_couple_home_world
-- -----------------------------------------------------------------------------

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

GRANT EXECUTE ON FUNCTION upsert_couple_home_world(
  text, text, jsonb, uuid[], int, text, text
) TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage: couple-home-world
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple-home-world',
  'couple-home-world',
  true,
  1048576,
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS couple_home_world_insert_member ON storage.objects;
DROP POLICY IF EXISTS couple_home_world_update_member ON storage.objects;
DROP POLICY IF EXISTS couple_home_world_select_member ON storage.objects;

CREATE POLICY couple_home_world_insert_member
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'couple-home-world'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY couple_home_world_update_member
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'couple-home-world'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY couple_home_world_select_member
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'couple-home-world'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );
