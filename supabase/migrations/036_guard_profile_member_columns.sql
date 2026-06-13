-- 036_guard_profile_member_columns.sql
--
-- Harden guard_profile_update() against member self-mutation of identity /
-- credential columns via direct PostgREST writes.
--
-- Why: RLS policy `member_update_own_profile` allows a member to UPDATE their
-- own profiles row, and RLS cannot restrict WHICH columns. The guard trigger is
-- the column-level boundary. The prior version pinned portal_role, the review
-- fields, and account_status — but a logged-in member, using the public anon
-- key + their JWT against /rest/v1/profiles, could still set:
--   • cert_status  → forge their certification standing (active_holder),
--                    which drives the public /directory + /verify listing
--   • first_name / middle_name / last_name → change the legal name ON AN
--                    APPROVED CREDENTIAL, bypassing the name_change_requests
--                    review workflow entirely
--   • email        → diverge the contact email from their auth identity
--   • stripe_customer_id → detach/repoint their billing linkage
--
-- This was verified live (a member JWT PATCH succeeded on all of the above).
-- None of these grant admin (portal_role / account_status stay locked), so it
-- is a data-integrity / workflow-bypass issue rather than privilege escalation.
--
-- Fix: pin these columns for non-admin callers. Legal name stays editable while
-- the account is still onboarding (account_status <> 'approved') so the
-- self-service onboarding form (components/onboarding-flow.tsx) keeps working,
-- and locks once approved. Admins / superadmins / service_role are unaffected.

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Superadmins and the service role may change anything, including portal_role.
  IF public.is_superadmin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Everyone else (incl. regular admins) may never change portal_role:
  -- only a superadmin can mint or demote admins.
  NEW.portal_role := OLD.portal_role;

  -- Admins keep their other powers (edit member fields, review queues).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- ── Member (non-admin) writes ──────────────────────────────────────────────
  -- Never self-writable: review fields, billing linkage, credential standing,
  -- and the account email (identity is synced from auth, not free-edited here).
  NEW.account_review_notes := OLD.account_review_notes;
  NEW.account_reviewed_at  := OLD.account_reviewed_at;
  NEW.stripe_customer_id   := OLD.stripe_customer_id;
  NEW.cert_status          := OLD.cert_status;
  NEW.email                := OLD.email;

  -- Legal name is editable during onboarding (pre-approval data entry) but
  -- locked once the account is approved — post-approval changes must go through
  -- the name_change_requests review workflow.
  IF OLD.account_status = 'approved' THEN
    NEW.first_name  := OLD.first_name;
    NEW.middle_name := OLD.middle_name;
    NEW.last_name   := OLD.last_name;
  END IF;

  -- A member may only move their OWN account_status to 'pending' (resubmission);
  -- they can never self-approve or self-reject.
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NEW.account_status <> 'pending' THEN
    NEW.account_status := OLD.account_status;
  END IF;

  RETURN NEW;
END;
$function$;
