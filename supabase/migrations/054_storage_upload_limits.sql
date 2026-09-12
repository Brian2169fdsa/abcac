-- ABCAC — enforce upload size/type limits at the storage layer.
--
-- Every member upload form (certificates, CEU proof, name-change ID, paper
-- application packets, testing supporting documents) already checks file
-- size (10MB) and extension (PDF/JPG/PNG) in the browser before calling
-- supabase.storage.upload(). That check is client-side only — the storage
-- RLS policies only ever verified the destination folder matched the
-- uploader's own uid, never the file's size or type, so a modified or
-- scripted client could still push an oversized file or an arbitrary MIME
-- type into these buckets. Supabase Storage enforces file_size_limit and
-- allowed_mime_types server-side per bucket, so set the same 10MB / PDF-JPG-
-- PNG limits there as the actual, unbypassable rule.

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB, matches every upload form's client-side check
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']
WHERE id IN ('member-documents', 'ceu-certificates', 'name-change-docs');
