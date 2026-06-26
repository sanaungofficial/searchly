-- Service role uploads for coach profile photos (Airtable sync → avatars/coaches/{id}/photo.*)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'service_role_avatars_all'
  ) THEN
    CREATE POLICY "service_role_avatars_all"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'avatars')
    WITH CHECK (bucket_id = 'avatars');
  END IF;
END $$;
