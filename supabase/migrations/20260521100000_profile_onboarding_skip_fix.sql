-- profiles 行が無い場合でもスキップを保存できるようにする

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

  INSERT INTO profiles (id, profile_onboarding_skipped)
  VALUES (v_user_id, ARRAY[p_field])
  ON CONFLICT (id) DO UPDATE
  SET profile_onboarding_skipped = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(profiles.profile_onboarding_skipped, '{}'::text[]) || ARRAY[p_field]
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION append_profile_onboarding_skipped(text) TO authenticated;
