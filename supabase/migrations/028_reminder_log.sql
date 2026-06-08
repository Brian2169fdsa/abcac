-- ABCAC — REMINDER LOG (dedupe + audit for the platform reminder engine)
-- The Vercel-cron reminder route (and the manual "send reminder" action) record
-- every reminder they send here. A UNIQUE dedupe_key makes sends idempotent —
-- the route inserts ON CONFLICT DO NOTHING, so a given reminder (e.g. the 30-day
-- renewal notice for a specific certification) is delivered at most once.
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,                 -- renewal_90 | renewal_60 | renewal_30 | ceu_shortfall | doc_request | task_due
  dedupe_key    TEXT NOT NULL,                 -- stable key, e.g. 'renewal:<certId>:30'
  channel       TEXT NOT NULL DEFAULT 'email', -- email | portal | both
  detail        JSONB,
  sent_by       UUID REFERENCES public.profiles(id), -- NULL = automated cron; set for manual sends
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_dedupe ON public.reminder_log(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_reminder_member ON public.reminder_log(member_id);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Admins (and superadmins via is_admin()) may read the reminder history. Writes
-- happen through the service role (cron route / server actions), which bypasses
-- RLS, so no member-facing policy is needed.
DROP POLICY IF EXISTS "admin_read_reminder_log" ON public.reminder_log;
CREATE POLICY "admin_read_reminder_log" ON public.reminder_log
  FOR SELECT USING (public.is_admin());
