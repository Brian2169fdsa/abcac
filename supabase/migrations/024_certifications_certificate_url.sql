-- ───────────────────────────────────────────────────────────
-- 024_certifications_certificate_url.sql
--
-- Add the missing `certificate_url` column to public.certifications.
--
-- The admin "Issue Certification" form (src/components/admin/issue-cert-form.tsx)
-- uploads the physical certificate to the member-documents bucket and stores the
-- resulting STORAGE PATH on `certifications.certificate_url`. That column never
-- actually existed on this table (migration 018's header comment misread
-- migration 001 — the `certificate_url` at 001:46 belongs to `ceu_records`, not
-- `certifications`). PostgREST rejects any insert that references an unknown
-- column, so every credential issuance was being rejected.
--
-- The member download path (src/components/certificate-actions.tsx) already reads
-- this column to sign a download URL, so no app change is needed once the column
-- exists.
--
-- Additive + idempotent: safe to re-run, no data backfill required.
-- ───────────────────────────────────────────────────────────

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS certificate_url TEXT;
