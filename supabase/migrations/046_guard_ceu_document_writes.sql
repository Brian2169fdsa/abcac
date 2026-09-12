-- ABCAC — CEU RECORD + DOCUMENT WRITE GUARDS (hardening)
--
-- ceu_records and documents still carried the original single FOR ALL member
-- policy from 001 (members_own_ceu / members_own_docs) with no column guard, so
-- a signed-in member could UPDATE the decision columns on their OWN rows
-- (self-set status='approved', clear admin_notes, forge reviewed_at) straight
-- through PostgREST. Approved CEU hours drive the dashboard compliance KPI,
-- renewal readiness, and the reminder engine, so this is a workflow-integrity
-- gap — the same class 029 closed for applications and the request tables.
--
-- Fix: BEFORE INSERT/UPDATE guard triggers that pin the decision columns for
-- non-admin / non-service callers. Members can still insert their own CEU and
-- document rows (forced to 'pending') and edit their own descriptive fields.
-- Admin and service-role writes are untouched. Idempotent.

-- ───────────────────────────────────────────────────────────
-- 1. CEU RECORDS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_ceu_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status      := 'pending';
    NEW.admin_notes := NULL;
    NEW.reviewed_at := NULL;
  ELSE
    NEW.member_id   := OLD.member_id;
    NEW.status      := OLD.status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_ceu_write ON public.ceu_records;
CREATE TRIGGER tr_guard_ceu_write
  BEFORE INSERT OR UPDATE ON public.ceu_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_ceu_write();

-- ───────────────────────────────────────────────────────────
-- 2. DOCUMENTS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_document_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status      := 'pending';
    NEW.admin_notes := NULL;
    NEW.reviewed_at := NULL;
  ELSE
    NEW.member_id   := OLD.member_id;
    NEW.status      := OLD.status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_document_write ON public.documents;
CREATE TRIGGER tr_guard_document_write
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_write();
