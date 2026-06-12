-- generating で固まった couple_home_world をリセット
UPDATE couple_home_world
SET
  status = 'failed',
  last_error = COALESCE(last_error, 'manual_reset'),
  updated_at = now()
WHERE status = 'generating';
