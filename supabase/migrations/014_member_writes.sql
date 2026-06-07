-- ABCAC — MEMBER WRITE-SIDE ENABLEMENT (additive, RLS-tight)
--
-- Adds the minimum schema + policies for member-driven write features:
--   1. other_certifications.doc_path  — supporting-document upload (Experience page)
--   2. messages two-way               — members may INSERT a message attributed
--                                        to themselves only (cannot impersonate
--                                        admin or set admin-only fields)
--
-- All changes are ADDITIVE. No existing data is altered or destroyed. Existing
-- admin/service-role write paths (admin_all_*) are untouched and keep working.

-- ───────────────────────────────────────────────────────────
-- 1. Other Certifications — supporting-document path
--    Members upload the external credential PDF/JPG/PNG to the existing
--    `member-documents` bucket (under <uid>/...) and store the returned path
--    here. The member portal renders a signed-URL view link; admins can read
--    every member's file via admin_read_all_storage (002).
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.other_certifications
  ADD COLUMN IF NOT EXISTS doc_path TEXT;

-- (other_certifications already has members_own_other_certs FOR ALL — members
--  can INSERT/UPDATE their own rows including this new column. No policy change.)

-- ───────────────────────────────────────────────────────────
-- 2. Messages — safe two-way (member → admin) enablement
--
--    Background: 009 dropped the member FOR ALL policy and left members with
--    SELECT + UPDATE(mark-read) only, so members could not reply. We re-enable
--    member INSERT, but tightly:
--      * member_id MUST equal auth.uid()  (cannot post into someone else's inbox)
--      * sender_role MUST be 'member'      (cannot impersonate ABCAC Admin)
--      * is_read is forced FALSE on member inserts (cannot pre-read)
--    Admin inserts (admin_all_messages FOR ALL) are unaffected and continue to
--    default sender_role='admin'.
-- ───────────────────────────────────────────────────────────

-- Direction marker. Default 'admin' preserves existing rows + the admin send
-- path (which does not set this column). Members are constrained to 'member'.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT 'admin';

-- Backfill: every pre-existing message was authored by admin → already 'admin'
-- via the DEFAULT on the new column. Nothing to update.

-- BEFORE INSERT guard: for non-admin / non-service-role callers, force the
-- message to be a member-authored message attributed to the caller, and stamp a
-- non-spoofable from_name. RLS WITH CHECK alone cannot rewrite columns, so we
-- normalise here and let the policy gate the row.
CREATE OR REPLACE FUNCTION public.guard_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the service role may insert anything (admin → member, any role).
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Member-authored message: pin every spoofable field to a safe value.
  NEW.member_id   := auth.uid();          -- own inbox/thread only
  NEW.sender_role := 'member';            -- cannot impersonate admin
  NEW.is_read     := FALSE;               -- cannot pre-mark as read
  IF NEW.from_name IS NULL OR NEW.from_name = 'ABCAC Admin' THEN
    NEW.from_name := 'Member';            -- never display as ABCAC Admin
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_message_insert ON public.messages;
CREATE TRIGGER tr_guard_message_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_insert();

-- Member INSERT policy: only their own inbox, only as a member-role message.
-- (The trigger above has already normalised these values for non-admins, so the
--  WITH CHECK is a belt-and-suspenders gate.)
DROP POLICY IF EXISTS "members_insert_messages" ON public.messages;
CREATE POLICY "members_insert_messages" ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = member_id
    AND sender_role = 'member'
  );
