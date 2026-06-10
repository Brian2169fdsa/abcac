-- ABCAC — RESERVE SUPERADMIN (M4: remove the single-point-of-failure)
-- The platform had exactly one superadmin (brianreinhart3617@gmail.com). If that
-- account is lost/locked, no one can manage roles or the automation kill switch,
-- and `changeMemberRole` deliberately refuses self-demotion (anti-lockout), so
-- recovery would require the service-role key. This seeds a SECOND, reserve
-- superadmin so there is always a backup operator.
--
-- Idempotent + safe to apply now: the UPDATE only promotes the reserve email IF a
-- profile with that address already exists (e.g. the operator has signed in at
-- least once); otherwise it is a no-op. Re-run after the reserve account first
-- signs in. To use a different reserve operator, change the email below.
--
-- Bypasses guard_profile_update for the same reason as migration 026: a direct
-- Management-API connection is neither a superadmin (no auth.uid()) nor the
-- service_role, so the immutability trigger would otherwise revert the change.

ALTER TABLE public.profiles DISABLE TRIGGER tr_guard_profile_update;
UPDATE public.profiles SET portal_role = 'superadmin'
  WHERE email = 'brian@manageai.io'
    AND portal_role <> 'superadmin';
ALTER TABLE public.profiles ENABLE TRIGGER tr_guard_profile_update;

-- Recovery note (no auth.uid(), service-role/Management API only):
--   UPDATE public.profiles SET portal_role = 'superadmin' WHERE email = '<operator>';
-- run with tr_guard_profile_update temporarily disabled, exactly as above.
