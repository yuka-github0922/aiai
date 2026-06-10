-- get_partner_summary: 相談AI用に display_name / birth_date / residence を追加
-- partner_impression は相談者本人のみの主観のため返さない

DROP FUNCTION IF EXISTS get_partner_summary();

CREATE OR REPLACE FUNCTION get_partner_summary()
RETURNS TABLE (
  display_name          TEXT,
  birth_date            DATE,
  mbti                  TEXT,
  animal_zodiac         TEXT,
  residence             TEXT,
  basic_values          TEXT,
  gender                TEXT,
  birth_year            SMALLINT,
  communication_style   TEXT,
  comfortable_phrases   TEXT,
  avoid_phrases         TEXT,
  notes                 TEXT
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
    p.display_name,
    s.birth_date,
    s.mbti,
    s.animal_zodiac,
    s.residence,
    s.basic_values,
    s.gender,
    s.birth_year,
    s.communication_style,
    s.comfortable_phrases,
    s.avoid_phrases,
    s.notes
  FROM ai_summaries s
  LEFT JOIN profiles p ON p.id = s.user_id
  WHERE s.user_id = v_partner_id
    AND s.couple_id = v_couple_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partner_summary() TO authenticated;
