-- get_partner_insights_for_nudge: 暗号列を返す版に更新

DROP FUNCTION IF EXISTS get_partner_insights_for_nudge(INT);

CREATE OR REPLACE FUNCTION get_partner_insights_for_nudge(limit_param INT DEFAULT 5)
RETURNS TABLE (
  partner_hint_encrypted TEXT,
  partner_hint_iv        TEXT,
  partner_hint_auth_tag  TEXT,
  created_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_couple_id  UUID;
  v_partner_id UUID;
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

  SELECT cm.user_id
  INTO v_partner_id
  FROM couple_members cm
  WHERE cm.couple_id = v_couple_id
    AND cm.user_id != v_uid
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ri.partner_hint_encrypted,
    ri.partner_hint_iv,
    ri.partner_hint_auth_tag,
    ri.created_at
  FROM relationship_insights ri
  WHERE ri.user_id = v_partner_id
    AND ri.partner_hint_encrypted IS NOT NULL
    AND ri.partner_hint_iv IS NOT NULL
    AND ri.partner_hint_auth_tag IS NOT NULL
  ORDER BY ri.created_at DESC
  LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_insights_for_nudge(INT) TO authenticated;
