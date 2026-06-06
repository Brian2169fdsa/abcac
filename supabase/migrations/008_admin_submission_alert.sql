-- ABCAC — ADMIN ALERT ON ACCOUNT SUBMISSION (additive, safe)
-- Emails ABCAC staff when a new member submits their registration for approval
-- (i.e. account_submitted_at is newly set while the account is still pending).
-- Fires ONLY on that transition, so admin approval/edits don't trigger it.
-- Reuses notify_events() (migration 003) → the `events` Edge Function, which
-- no-ops gracefully if Vault/Resend secrets aren't configured.

CREATE TRIGGER tr_account_submitted
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    NEW.account_submitted_at IS DISTINCT FROM OLD.account_submitted_at
    AND NEW.account_status = 'pending'
  )
  EXECUTE FUNCTION public.notify_events();
