-- ふたりの似顔絵：Supabase Storage（jsonb に巨大 data URL を入れない）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple-avatars',
  'couple-avatars',
  true,
  524288,
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS couple_avatars_insert_member ON storage.objects;
DROP POLICY IF EXISTS couple_avatars_update_member ON storage.objects;
DROP POLICY IF EXISTS couple_avatars_select_member ON storage.objects;

CREATE POLICY couple_avatars_insert_member
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY couple_avatars_update_member
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY couple_avatars_select_member
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'couple-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT cm.couple_id::text
      FROM couple_members cm
      WHERE cm.user_id = auth.uid()
    )
  );
