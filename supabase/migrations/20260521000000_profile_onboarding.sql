-- =============================================================================
-- プロフィールオンボーディング Phase 1
-- - birth_date / residence / partner_impression
-- - profiles 進捗カラム
-- - upsert_ai_summary 拡張
-- =============================================================================

ALTER TABLE ai_summaries
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS residence text,
  ADD COLUMN IF NOT EXISTS partner_impression text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_onboarding_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_onboarding_skipped text[] NOT NULL DEFAULT '{}';

-- birth_year のみ入っている既存行は 1/1 で補完（任意）
UPDATE ai_summaries
SET birth_date = make_date(birth_year, 1, 1)
WHERE birth_date IS NULL
  AND birth_year IS NOT NULL;

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
    partner_impression  = COALESCE(EXCLUDED.partner_impression, ai_summaries.partner_impression);
END;
$$;

CREATE OR REPLACE FUNCTION append_profile_onboarding_skipped(p_field text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  UPDATE profiles
  SET profile_onboarding_skipped = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(profile_onboarding_skipped, '{}'::text[]) || ARRAY[p_field]
      )
    )
  )
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION dismiss_profile_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  UPDATE profiles
  SET profile_onboarding_dismissed_at = now()
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION complete_profile_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  UPDATE profiles
  SET profile_onboarding_completed_at = now()
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION append_profile_onboarding_skipped(text) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_profile_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_profile_onboarding() TO authenticated;
