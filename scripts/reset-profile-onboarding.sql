-- プロフィールオンボーディングの表示をリセット（自分の行のみ）
UPDATE profiles
SET
  profile_onboarding_completed_at = NULL,
  profile_onboarding_dismissed_at = NULL,
  profile_onboarding_skipped = '{}'
WHERE id = auth.uid();

-- 確認
SELECT
  profile_onboarding_completed_at,
  profile_onboarding_dismissed_at,
  profile_onboarding_skipped
FROM profiles
WHERE id = auth.uid();
