-- ABCAC — REQUEST-TABLE WRITE GUARDS + MESSAGE UPDATE RESTRICTION (hardening)
-- Closes the workflow-integrity gaps from the pre-launch security audit (S1/S2).
--
-- S1: applications / name_change_requests / verification_requests used a single
--     FOR ALL member policy, so a member could UPDATE the decision/status
--     columns on their OWN row (self-set status='approved', verification_result
--     ='verified', etc.). We add BEFORE INSERT/UPDATE guard triggers that pin
--     those columns for non-admin/non-service callers — the same pattern already
--     used for reciprocity_requests (017) and supervision_records (023).
-- S2: members_update_messages had no column restriction, so a member could
--     rewrite the body/subject of an admin message in their own inbox. We pin
--     every column except is_read for non-admin updates (mark-read still works).
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

-- ───────────────────────────────────────────────────────────
-- 1. APPLICATIONS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_application_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status         := 'submitted';
    NEW.reviewed_at    := NULL;
    NEW.admin_notes    := NULL;
    NEW.est_completion := NULL;
  ELSE
    NEW.status         := OLD.status;
    NEW.reviewed_at    := OLD.reviewed_at;
    NEW.admin_notes    := OLD.admin_notes;
    NEW.est_completion := OLD.est_completion;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_application_write ON public.applications;
CREATE TRIGGER tr_guard_application_write
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_write();

-- ───────────────────────────────────────────────────────────
-- 2. NAME-CHANGE REQUESTS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_name_change_write()
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
    NEW.status      := OLD.status;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_name_change_write ON public.name_change_requests;
CREATE TRIGGER tr_guard_name_change_write
  BEFORE INSERT OR UPDATE ON public.name_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_name_change_write();

-- ───────────────────────────────────────────────────────────
-- 3. VERIFICATION REQUESTS
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_verification_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A signed-in member's request is always a pending portal request.
    NEW.status              := 'pending';
    NEW.source              := 'portal';
    NEW.verification_result := NULL;
    NEW.verified_at         := NULL;
    NEW.completed_at        := NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.source              := OLD.source;
    NEW.verification_result := OLD.verification_result;
    NEW.verified_at         := OLD.verified_at;
    NEW.completed_at        := OLD.completed_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_verification_write ON public.verification_requests;
CREATE TRIGGER tr_guard_verification_write
  BEFORE INSERT OR UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_verification_write();

-- ───────────────────────────────────────────────────────────
-- 4. MESSAGES — members may only flip is_read on their own messages
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Non-admin: every column except is_read is frozen to its old value.
  NEW.member_id   := OLD.member_id;
  NEW.from_name   := OLD.from_name;
  NEW.subject     := OLD.subject;
  NEW.body        := OLD.body;
  NEW.sender_role := OLD.sender_role;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_guard_message_update ON public.messages;
CREATE TRIGGER tr_guard_message_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();
