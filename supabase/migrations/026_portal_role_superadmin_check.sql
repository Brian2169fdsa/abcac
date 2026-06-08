-- ABCAC — ROLE TIERS FOLLOW-UP (allow the 'superadmin' value)
-- Migration 025 added the superadmin tier + helpers but the profiles table
-- still carried a CHECK constraint limiting portal_role to ('member','admin'),
-- so the 025 seed of the god account was silently rejected. This widens the
-- constraint to include 'superadmin' and re-seeds the god account.
--
-- NOTE: the seed must bypass the guard_profile_update trigger, because a direct
-- Management-API connection is neither a superadmin (no auth.uid()) nor the
-- service_role, so the trigger would otherwise reset portal_role to its old
-- value. Applied to the live DB via the Supabase Management API.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_portal_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_portal_role_check
  CHECK (portal_role = ANY (ARRAY['member'::text, 'admin'::text, 'superadmin'::text]));

-- Re-seed the god account, bypassing the role-immutability trigger.
ALTER TABLE public.profiles DISABLE TRIGGER tr_guard_profile_update;
UPDATE public.profiles SET portal_role = 'superadmin'
  WHERE email = 'brianreinhart3617@gmail.com';
ALTER TABLE public.profiles ENABLE TRIGGER tr_guard_profile_update;
