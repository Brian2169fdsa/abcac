-- ABCAC — RLS HARDENING (fixes privilege-escalation / self-approval)
-- The members_own_profile policy is FOR ALL with no column restriction, so a
-- member could `update profiles set portal_role='admin'` or
-- `set account_status='approved'`. RLS WITH CHECK can't compare NEW vs OLD, so
-- we enforce column immutability with a BEFORE UPDATE trigger.

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the service role may change anything.
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- A member can never change these.
  NEW.portal_role         := OLD.portal_role;
  NEW.account_review_notes := OLD.account_review_notes;
  NEW.account_reviewed_at  := OLD.account_reviewed_at;

  -- A member may only move their OWN account_status to 'pending' (resubmission);
  -- they can never self-approve or self-reject.
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NEW.account_status <> 'pending' THEN
    NEW.account_status := OLD.account_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_profile_update ON public.profiles;
CREATE TRIGGER tr_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- ───────────────────────────────────────────────────────────
-- Messages: members may read + mark-read only — not insert (no spoofing an
-- "ABCAC Admin" message into their own inbox). Admins still insert via
-- admin_all_messages.
-- ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_own_messages" ON public.messages;
CREATE POLICY "members_read_messages" ON public.messages
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "members_update_messages" ON public.messages
  FOR UPDATE USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
