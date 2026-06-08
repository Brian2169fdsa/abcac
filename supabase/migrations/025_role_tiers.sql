-- ABCAC — ROLE TIERS (adds SUPERADMIN, the "god account" tier)
-- Introduces a third portal_role tier so portal_role ∈ {member, admin, superadmin}.
--   • superadmin keeps every admin power (is_admin() is true for both tiers)
--   • only a superadmin (or service_role) may mint/demote admins
--
-- IMPORTANT: This migration must be applied to the live database via the
-- Supabase Management API. Do NOT run it locally — just keep this file as the
-- source of truth. It is idempotent (CREATE OR REPLACE / IF NOT EXISTS).

-- ───────────────────────────────────────────────────────────
-- 1. SUPERADMIN HELPER  (SECURITY DEFINER bypasses RLS → no recursion)
--    Mirrors the exact shape of is_admin() from 002.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND portal_role = 'superadmin'
  );
$$;

-- ───────────────────────────────────────────────────────────
-- 2. ADMIN HELPER  (redefined — superadmin keeps every admin power)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND portal_role IN ('admin', 'superadmin')
  );
$$;

-- ───────────────────────────────────────────────────────────
-- 3. PROFILE GUARD  (role immutability — only superadmin mints admins)
--    Copy of the 009 body, but portal_role may only be CHANGED by a
--    superadmin (or service_role). Regular admins keep every other
--    admin power yet can no longer mint/demote admins. Members still
--    can't touch portal_role at all.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- A member can never change these.
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
-- 4. SEED THE GOD ACCOUNT
-- ───────────────────────────────────────────────────────────
UPDATE public.profiles
SET portal_role = 'superadmin'
WHERE email = 'brianreinhart3617@gmail.com';
