-- ABCAC — PORTAL ENHANCEMENTS (additive only)
-- Adds application attestation/e-signature + member notes, and member-facing
-- status-change email notifications. Nothing is dropped or renamed.

-- ───────────────────────────────────────────────────────────
-- 1. APPLICATION attestation + member notes (additive columns)
--    member_notes holds the applicant's own summary (previously mis-stored in
--    admin_notes, which is reserved for staff/reviewer notes).
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS member_notes   TEXT,
  ADD COLUMN IF NOT EXISTS attested       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attested_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_name TEXT;

-- ───────────────────────────────────────────────────────────
-- 2. STATUS-CHANGE NOTIFICATIONS → events Edge Function
--    Fire ONLY when status actually changes, so members aren't spammed on
--    unrelated edits. Reuses notify_events() (migration 003), which posts
--    { type:'UPDATE', table, record } and no-ops if Vault secrets are unset.
-- ───────────────────────────────────────────────────────────
CREATE TRIGGER tr_status_application
  AFTER UPDATE ON public.applications
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_events();

CREATE TRIGGER tr_status_document
  AFTER UPDATE ON public.documents
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_events();

CREATE TRIGGER tr_status_ceu
  AFTER UPDATE ON public.ceu_records
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_events();
