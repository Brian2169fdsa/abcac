-- ABCAC — STRIPE CUSTOMER ID COLUMN + GUARD
-- Adds stripe_customer_id to profiles and hardens the BEFORE UPDATE trigger so
-- members cannot set their own Stripe customer id (only the service-role webhook
-- may, because the function early-returns for service_role/admins).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Re-create the trigger function identical to migration 009 but with the
-- additional stripe_customer_id immutability line for non-admin callers.
-- The trigger itself (tr_guard_profile_update) already exists; we only need
-- CREATE OR REPLACE FUNCTION.
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
  NEW.portal_role              := OLD.portal_role;
  NEW.account_review_notes     := OLD.account_review_notes;
  NEW.account_reviewed_at      := OLD.account_reviewed_at;
  NEW.stripe_customer_id       := OLD.stripe_customer_id;

  -- A member may only move their OWN account_status to 'pending' (resubmission);
  -- they can never self-approve or self-reject.
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     AND NEW.account_status <> 'pending' THEN
    NEW.account_status := OLD.account_status;
  END IF;

  RETURN NEW;
END;
$$;
