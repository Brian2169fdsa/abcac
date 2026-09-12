-- ABCAC — lock CEU records and documents once ABCAC has reviewed them.
--
-- 046 pinned the decision columns (status/admin_notes/reviewed_at) on UPDATE
-- so a member could not self-approve their own record. It did not stop a
-- member from editing an already-decided record's OWN descriptive fields
-- (course name, hours, file name...) after approval/rejection, and there was
-- no DELETE guard at all — a member could delete an approved CEU record or
-- an accepted document outright, undermining the review trail those drive
-- (renewal compliance math, application document checklists). The member
-- portal now offers edit/delete for these two record types, scoped to
-- 'pending' only; this migration makes that the enforced rule, not just a UI
-- convention, so a stale page or a direct API call cannot bypass it.

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
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'This CEU record has already been reviewed and can no longer be changed.';
    END IF;
    NEW.member_id   := OLD.member_id;
    NEW.status      := OLD.status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_ceu_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN OLD;
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'This CEU record has already been reviewed and can no longer be deleted.';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_ceu_delete ON public.ceu_records;
CREATE TRIGGER tr_guard_ceu_delete
  BEFORE DELETE ON public.ceu_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_ceu_delete();

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
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'This document has already been reviewed and can no longer be changed.';
    END IF;
    NEW.member_id   := OLD.member_id;
    NEW.status      := OLD.status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_document_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN OLD;
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'This document has already been reviewed and can no longer be deleted.';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_document_delete ON public.documents;
CREATE TRIGGER tr_guard_document_delete
  BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_delete();
