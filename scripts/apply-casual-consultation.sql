-- 手動適用用（supabase/migrations/20260525100000_casual_consultation.sql と同内容）

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'consultation';

CREATE UNIQUE INDEX IF NOT EXISTS consultations_user_casual_unique
  ON consultations (user_id)
  WHERE kind = 'casual';

CREATE OR REPLACE FUNCTION ensure_casual_consultation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT cm.couple_id INTO v_couple_id
  FROM couple_members cm
  WHERE cm.user_id = v_user_id
  LIMIT 1;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'couple not found';
  END IF;

  SELECT c.id INTO v_id
  FROM consultations c
  WHERE c.user_id = v_user_id
    AND c.kind = 'casual'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO consultations (user_id, couple_id, title, kind)
  VALUES (v_user_id, v_couple_id, '雑談', 'casual')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION ensure_casual_consultation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_casual_consultation() TO authenticated;

-- PostgREST に RPC を認識させる（Supabase SQL Editor 実行後に重要）
NOTIFY pgrst, 'reload schema';
