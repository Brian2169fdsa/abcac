-- ───────────────────────────────────────────────────────────
-- 018_certificate_file.sql
--
-- Physical certificate file upload → member Certificate & Wallet Card download.
--
-- Storage strategy (additive only):
--   * Reuse the existing PRIVATE `member-documents` bucket (002) — NO new bucket.
--   * The admin "Issue Certification" form uploads the physical certificate to
--     `<member_id>/certs/<timestamp>_<filename>` and stores that STORAGE PATH on
--     `public.certifications.certificate_url` (the column already exists, added in
--     migration 001 — so NO new column is needed).
--   * The leading `<member_id>` path segment is what lets the existing member-read
--     policy (`member_read_docs`, 001: auth.uid() = (storage.foldername(name))[1])
--     serve the file back to its owner via a signed URL on the member portal.
--
-- The ONLY gap this migration closes: admins currently have SELECT on every
-- member's storage (`admin_read_all_storage`, 002) but NO INSERT path into other
-- members' folders. `member_upload_docs` (001) only allows a caller to write into
-- their OWN `<uid>/...` prefix, so an admin uploading into `<member_id>/certs/...`
-- would be denied by RLS. This migration adds an admin INSERT (and UPDATE, to allow
-- re-uploads/upsert) policy on storage.objects for `member-documents`.
--
-- Idempotent: safe to re-run. No data backfill required.
-- ───────────────────────────────────────────────────────────

-- Admins may upload files into any member's folder in member-documents
-- (e.g. issued certificate PDFs at <member_id>/certs/...).
DROP POLICY IF EXISTS "admin_upload_member_documents" ON storage.objects;
CREATE POLICY "admin_upload_member_documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-documents'
    AND public.is_admin()
  );

-- Allow admins to overwrite/replace a previously uploaded certificate file.
DROP POLICY IF EXISTS "admin_update_member_documents" ON storage.objects;
CREATE POLICY "admin_update_member_documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'member-documents'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.is_admin()
  );
