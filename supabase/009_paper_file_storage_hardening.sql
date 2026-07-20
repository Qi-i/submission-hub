-- Submission Hub — Migration 009: private paper document storage hardening

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'paper-files',
  'paper-files',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/json',
    'application/octet-stream',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Read own files" ON storage.objects;
DROP POLICY IF EXISTS "Upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Update own files" ON storage.objects;
DROP POLICY IF EXISTS "Delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Read own paper files" ON storage.objects;
DROP POLICY IF EXISTS "Upload own paper files" ON storage.objects;
DROP POLICY IF EXISTS "Update own paper files" ON storage.objects;
DROP POLICY IF EXISTS "Delete own paper files" ON storage.objects;

CREATE POLICY "Read own paper files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'paper-files'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Upload own paper files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'paper-files'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Update own paper files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'paper-files'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'paper-files'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Delete own paper files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'paper-files'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );
