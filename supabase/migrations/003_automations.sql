-- ABCAC MEMBER PORTAL — AUTOMATIONS MIGRATION
-- Schedules the daily reminder job (pg_cron) and provides the trigger helper
-- for routing table INSERTs to the `events` Edge Function (pg_net).
--
-- Secrets are read from Supabase Vault so nothing sensitive lives in this file.
-- Before this works you must create two Vault secrets (Dashboard → Project
-- Settings → Vault, or SQL below) — replace the placeholder values:
--   select vault.create_secret('https://<ref>.functions.supabase.co', 'edge_functions_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>',                    'service_role_key');

-- ───────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- ───────────────────────────────────────────────────────────
-- 2. DATABASE-WEBHOOK TRIGGER → events Edge Function
--    Fires on INSERT for the tables that need an email. The payload mirrors
--    Supabase's native webhook shape ({ type, table, record }).
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  fn_url  TEXT;
  svc_key TEXT;
BEGIN
  SELECT decrypted_secret INTO fn_url  FROM vault.decrypted_secrets WHERE name = 'edge_functions_url';
  SELECT decrypted_secret INTO svc_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF fn_url IS NULL OR svc_key IS NULL THEN
    RETURN NEW;  -- not configured yet; do nothing
  END IF;

  PERFORM net.http_post(
    url     := fn_url || '/events',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || svc_key),
    body    := jsonb_build_object(
                 'type', TG_OP,
                 'table', TG_TABLE_NAME,
                 'record', to_jsonb(NEW))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_events_profiles      AFTER INSERT ON public.profiles              FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER tr_events_documents     AFTER INSERT ON public.documents             FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER tr_events_ceu           AFTER INSERT ON public.ceu_records           FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER tr_events_name_change   AFTER INSERT ON public.name_change_requests  FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER tr_events_verification  AFTER INSERT ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.notify_events();
CREATE TRIGGER tr_events_reciprocity   AFTER INSERT ON public.reciprocity_requests  FOR EACH ROW EXECUTE FUNCTION public.notify_events();

-- ───────────────────────────────────────────────────────────
-- 3. DAILY SCHEDULED REMINDERS → scheduled-reminders Edge Function
--    Runs every day at 14:00 UTC (~7am MST). Idempotent re-schedule.
-- ───────────────────────────────────────────────────────────
SELECT cron.unschedule('abcac-daily-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'abcac-daily-reminders');

SELECT cron.schedule(
  'abcac-daily-reminders',
  '0 14 * * *',
  $cron$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_functions_url') || '/scheduled-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))
  );
  $cron$
);
