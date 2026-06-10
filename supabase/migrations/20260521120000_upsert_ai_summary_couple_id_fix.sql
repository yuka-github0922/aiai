-- upsert_ai_summary: INSERT 時に couple_id を含める（NOT NULL 制約違反の修正）

CREATE OR REPLACE FUNCTION upsert_ai_summary(
  communication_style_param text DEFAULT NULL,
  comfortable_phrases_param   text DEFAULT NULL,
  avoid_phrases_param         text DEFAULT NULL,
  notes_param                 text DEFAULT NULL,
  gender_param                text DEFAULT NULL,
  birth_year_param            integer DEFAULT NULL,
  birth_date_param            date DEFAULT NULL,
  mbti_param                  text DEFAULT NULL,
  basic_values_param          text DEFAULT NULL,
  animal_zodiac_param         text DEFAULT NULL,
  residence_param             text DEFAULT NULL,
  partner_impression_param    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_couple_id uuid;
  v_birth_date date := birth_date_param;
  v_birth_year integer := birth_year_param;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT couple_id
  INTO v_couple_id
  FROM couple_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  IF v_birth_date IS NOT NULL THEN
    v_birth_year := EXTRACT(YEAR FROM v_birth_date)::integer;
  END IF;

  INSERT INTO ai_summaries (
    user_id,
    couple_id,
    communication_style,
    comfortable_phrases,
    avoid_phrases,
    notes,
    gender,
    birth_year,
    birth_date,
    mbti,
    basic_values,
    animal_zodiac,
    residence,
    partner_impression
  )
  VALUES (
    v_user_id,
    v_couple_id,
    communication_style_param,
    comfortable_phrases_param,
    avoid_phrases_param,
    notes_param,
    gender_param,
    v_birth_year,
    v_birth_date,
    mbti_param,
    basic_values_param,
    animal_zodiac_param,
    residence_param,
    partner_impression_param
  )
  ON CONFLICT (user_id, couple_id) DO UPDATE SET
    communication_style = COALESCE(EXCLUDED.communication_style, ai_summaries.communication_style),
    comfortable_phrases = COALESCE(EXCLUDED.comfortable_phrases, ai_summaries.comfortable_phrases),
    avoid_phrases       = COALESCE(EXCLUDED.avoid_phrases, ai_summaries.avoid_phrases),
    notes               = COALESCE(EXCLUDED.notes, ai_summaries.notes),
    gender              = COALESCE(EXCLUDED.gender, ai_summaries.gender),
    birth_year          = COALESCE(EXCLUDED.birth_year, ai_summaries.birth_year),
    birth_date          = COALESCE(EXCLUDED.birth_date, ai_summaries.birth_date),
    mbti                = COALESCE(EXCLUDED.mbti, ai_summaries.mbti),
    basic_values        = COALESCE(EXCLUDED.basic_values, ai_summaries.basic_values),
    animal_zodiac       = COALESCE(EXCLUDED.animal_zodiac, ai_summaries.animal_zodiac),
    residence           = COALESCE(EXCLUDED.residence, ai_summaries.residence),
    partner_impression  = COALESCE(EXCLUDED.partner_impression, ai_summaries.partner_impression),
    updated_at          = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_ai_summary(
  text, text, text, text, text, integer, date, text, text, text, text, text
) TO authenticated;
