-- =============================================================================
-- ふたりの特徴：カップル共通キャッシュ + 生成用データ取得 RPC
-- =============================================================================

CREATE TABLE IF NOT EXISTS cached_couple_traits (
  couple_id      uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  self_traits    jsonb NOT NULL,
  partner_traits jsonb,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  source_summary jsonb,
  model          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cached_couple_traits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON cached_couple_traits FROM anon;
GRANT SELECT ON cached_couple_traits TO authenticated;

CREATE POLICY cached_couple_traits_select_member
  ON cached_couple_traits
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
-- get_cached_couple_traits
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_cached_couple_traits()
RETURNS TABLE (
  couple_id      uuid,
  self_traits    jsonb,
  partner_traits jsonb,
  generated_at   timestamptz,
  source_summary jsonb,
  model          text
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
    c.model
  FROM cached_couple_traits c
  WHERE c.couple_id = v_couple_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cached_couple_traits() TO authenticated;

-- -----------------------------------------------------------------------------
-- upsert_cached_couple_traits
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION upsert_cached_couple_traits(
  p_self_traits    jsonb,
  p_partner_traits jsonb DEFAULT NULL,
  p_source_summary jsonb DEFAULT NULL,
  p_model          text DEFAULT 'unknown'
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

  INSERT INTO cached_couple_traits (
    couple_id,
    self_traits,
    partner_traits,
    generated_at,
    source_summary,
    model,
    updated_at
  )
  VALUES (
    v_couple_id,
    p_self_traits,
    p_partner_traits,
    now(),
    p_source_summary,
    p_model,
    now()
  )
  ON CONFLICT (couple_id) DO UPDATE SET
    self_traits    = EXCLUDED.self_traits,
    partner_traits = EXCLUDED.partner_traits,
    generated_at   = EXCLUDED.generated_at,
    source_summary = EXCLUDED.source_summary,
    model          = EXCLUDED.model,
    updated_at     = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_cached_couple_traits(jsonb, jsonb, jsonb, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_couple_profiles_for_traits（カップルメンバー2名分のプロフィール）
-- joined_at 昇順。partner_impression は各メンバーがパートナーについて書いた主観。
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_couple_profiles_for_traits()
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
    SELECT
      cm.user_id,
      cm.joined_at,
      p.display_name,
      s.gender,
      s.basic_values,
      s.communication_style,
      s.partner_impression
    FROM couple_members cm
    LEFT JOIN profiles p ON p.id = cm.user_id
    LEFT JOIN ai_summaries s
      ON s.user_id = cm.user_id
     AND s.couple_id = v_couple_id
    WHERE cm.couple_id = v_couple_id
    ORDER BY cm.joined_at ASC, cm.user_id ASC
  LOOP
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_member.user_id,
        'display_name', v_member.display_name,
        'gender', v_member.gender,
        'basic_values', v_member.basic_values,
        'communication_style', v_member.communication_style,
        'partner_impression', v_member.partner_impression
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_couple_profiles_for_traits() TO authenticated;

-- -----------------------------------------------------------------------------
-- get_couple_insights_for_traits（メンバーごとの relationship_insights）
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_couple_insights_for_traits(p_limit_per_member int DEFAULT 15)
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
  v_insights  jsonb;
  v_limit     int := GREATEST(COALESCE(p_limit_per_member, 15), 0);
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
          'partner_hint_encrypted', ri.partner_hint_encrypted,
          'partner_hint_iv', ri.partner_hint_iv,
          'partner_hint_auth_tag', ri.partner_hint_auth_tag,
          'created_at', ri.created_at
        )
        ORDER BY ri.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_insights
    FROM (
      SELECT
        partner_hint_encrypted,
        partner_hint_iv,
        partner_hint_auth_tag,
        created_at
      FROM relationship_insights
      WHERE user_id = v_member.user_id
        AND couple_id = v_couple_id
        AND partner_hint_encrypted IS NOT NULL
        AND partner_hint_iv IS NOT NULL
        AND partner_hint_auth_tag IS NOT NULL
      ORDER BY created_at DESC
      LIMIT v_limit
    ) ri;

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_member.user_id,
        'display_name', v_member.display_name,
        'insights', v_insights
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_couple_insights_for_traits(int) TO authenticated;
