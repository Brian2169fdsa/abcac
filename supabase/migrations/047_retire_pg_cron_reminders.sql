-- ABCAC — SINGLE REMINDER PATH (retire the pg_cron → Edge Function schedule)
--
-- Two reminder engines were scheduled for the same minute (14:00 UTC daily):
--   • pg_cron job `abcac-daily-reminders` (003) → supabase/functions/scheduled-reminders
--     — emails only, no dedupe log, and it auto-inserts a $150 renewal invoice.
--   • Vercel cron (vercel.json) → /api/cron/reminders → src/lib/reminders-runner.ts
--     — deduplicated via reminder_log, delivers in-portal messages AND email,
--     also covers document-request and task reminders.
-- Both were dormant only because Resend / Vault secrets were unset. The day
-- email goes live, members would receive every reminder twice.
--
-- The Vercel runner is the supported path. This migration removes the pg_cron
-- schedule so the Edge Function can never fire on its own. Idempotent; safe when
-- pg_cron is not installed or the job was never created.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'abcac-daily-reminders') THEN
      PERFORM cron.unschedule('abcac-daily-reminders');
    END IF;
  END IF;
END $$;
