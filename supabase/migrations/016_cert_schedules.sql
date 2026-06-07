-- ABCAC — 016_cert_schedules.sql
-- CERT DUE-DATES ENGINE: reference table keyed by credential type.
--
-- Purpose: normalize the renewal-cycle and CEU-requirement data per ABCAC
-- credential so that due-dates can be computed deterministically from a
-- member's certification.expiration_date (or last-renewal date) instead of
-- being hard-coded in multiple places (portal read-time logic + the
-- scheduled-reminders Edge Function).
--
-- Supabase remains the single source of truth: a member's actual due date is
-- derived from REAL state (certifications.expiration_date) + this reference
-- row + the member's notification_preferences opt-in. This table does NOT
-- store per-member due dates — it stores the *rules* used to compute them.
--
-- Additive only. RLS: any authenticated member may SELECT (reference data);
-- only admins (public.is_admin()) may INSERT/UPDATE/DELETE. Writes normally
-- come from scripts/import-cert-schedules.ts via the service-role key.
--
-- Credential codes cross-checked against
--   src/app/(site)/initial-certification/page.tsx:
--   CAC, CADAC, AADC, CCS, CCJP, CPRS, CPS.

CREATE TABLE IF NOT EXISTS public.cert_schedules (
  id uuid primary key default uuid_generate_v4(),
  credential_type        text not null unique,          -- e.g. CAC / CADAC / AADC / CCS / CCJP / CPS / CPRS
  renewal_cycle_months   integer not null default 24,   -- length of the renewal cycle in months
  ceu_total_required     integer not null default 40,   -- total CEU hours required per cycle
  ceu_ethics_required    integer not null default 3,    -- of which must be Ethics
  ceu_cultural_required  integer not null default 3,    -- of which must be Cultural Diversity
  grace_period_days      integer not null default 0,    -- days past expiry before lapse
  notes                  text,
  created_at             timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_cert_schedules_credential
  ON public.cert_schedules(credential_type);

ALTER TABLE public.cert_schedules ENABLE ROW LEVEL SECURITY;

-- Reference data: every authenticated member may read it.
DROP POLICY IF EXISTS "members_read_cert_schedules" ON public.cert_schedules;
CREATE POLICY "members_read_cert_schedules" ON public.cert_schedules
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins may write (service-role bypasses RLS entirely).
DROP POLICY IF EXISTS "admin_all_cert_schedules" ON public.cert_schedules;
CREATE POLICY "admin_all_cert_schedules" ON public.cert_schedules
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed one row per known ABCAC credential with sensible defaults.
-- 24-month cycle, 40 total CEUs with 3 Ethics + 3 Cultural Diversity where
-- applicable. CPRS / CPS are lower-tier credentials whose continuing-education
-- requirements differ; defaults are conservative placeholders the owner can
-- override by re-running the importer with the real spreadsheet.
INSERT INTO public.cert_schedules
  (credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes)
VALUES
  ('CAC',   24, 40, 3, 3, 0, 'Certified Addiction Counselor — entry-level AODA credential.'),
  ('CADAC', 24, 40, 3, 3, 0, 'Certified Alcohol & Drug Abuse Counselor — bachelor''s level.'),
  ('AADC',  24, 40, 3, 3, 0, 'Advanced Alcohol & Drug Counselor — master''s level.'),
  ('CCS',   24, 40, 3, 3, 0, 'Certified Clinical Supervisor — supervisory credential.'),
  ('CCJP',  24, 40, 3, 3, 0, 'Certified Criminal Justice Professional.'),
  ('CPRS',  24, 20, 2, 2, 0, 'Certified Peer Recovery Specialist — lower CE requirement; confirm against real schedule.'),
  ('CPS',   24, 40, 3, 3, 0, 'Certified Prevention Specialist.')
ON CONFLICT (credential_type) DO NOTHING;
