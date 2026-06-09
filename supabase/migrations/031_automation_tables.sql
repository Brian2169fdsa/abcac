-- ABCAC — AUTOMATION ENGINE TABLES (Phase 0 plumbing; ships fully disabled)
-- The decision engine records every evaluation in automation_runs, reads
-- per-workflow kill switches/thresholds from automation_config, and honors a
-- global pause in automation_global. Adapted to ABCAC's schema: there is no
-- separate members/admins table — both are public.profiles keyed by portal_role,
-- so every actor/member FK points at profiles(id).
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

-- ── 1. automation_runs — one row per evaluation, any outcome ──
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workflow      TEXT NOT NULL,                 -- 'ceu_review', 'account_approval', ...
  entity_type   TEXT NOT NULL,                 -- 'ceu_record', 'application', ...
  entity_id     UUID,
  member_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tier          TEXT NOT NULL,                 -- 'auto' | 'propose' | 'escalate'
  confidence    NUMERIC(4,3),                  -- 0.000–1.000; null for pure-fn runs
  rule_version  TEXT,
  model_version TEXT,
  staged_action JSONB,                         -- { handler, args } to run on approval
  anomaly_flags TEXT[] NOT NULL DEFAULT '{}',
  summary       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending_approval',
                -- auto_executed | pending_approval | approved | rejected | escalated | failed
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_queue ON public.automation_runs (status, workflow, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_entity ON public.automation_runs (entity_type, entity_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_automation_runs" ON public.automation_runs;
CREATE POLICY "admin_all_automation_runs" ON public.automation_runs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 2. automation_config — per-workflow kill switch + thresholds ──
CREATE TABLE IF NOT EXISTS public.automation_config (
  workflow          TEXT PRIMARY KEY,
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,   -- ships OFF
  auto_threshold    NUMERIC(4,3),
  propose_threshold NUMERIC(4,3),
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.automation_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_automation_config" ON public.automation_config;
CREATE POLICY "admin_all_automation_config" ON public.automation_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. automation_global — single-row global pause (superadmin only writes) ──
CREATE TABLE IF NOT EXISTS public.automation_global (
  id     BOOLEAN PRIMARY KEY DEFAULT TRUE,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT automation_global_singleton CHECK (id = TRUE)
);
ALTER TABLE public.automation_global ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_automation_global" ON public.automation_global;
CREATE POLICY "admin_read_automation_global" ON public.automation_global
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "superadmin_write_automation_global" ON public.automation_global;
CREATE POLICY "superadmin_write_automation_global" ON public.automation_global
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
INSERT INTO public.automation_global (id, paused) VALUES (TRUE, FALSE)
  ON CONFLICT (id) DO NOTHING;

-- ── 4. Seed every workflow OFF, with starting thresholds from the build spec ──
INSERT INTO public.automation_config (workflow, enabled, auto_threshold, propose_threshold) VALUES
  ('ceu_review',               FALSE, 0.95, 0.80),
  ('account_approval',         FALSE, 0.95, 0.80),
  ('doc_request',              FALSE, NULL, NULL),
  ('credential_verification',  FALSE, NULL, NULL),
  ('name_change',              FALSE, 0.90, 0.70),
  ('reciprocity',              FALSE, NULL, NULL),
  ('invoice_generation',       FALSE, NULL, NULL),
  ('payment_reconciliation',   FALSE, NULL, NULL),
  ('refund_void',              FALSE, NULL, NULL),
  ('certificate_issuance',     FALSE, NULL, NULL),
  ('print_request',            FALSE, NULL, NULL),
  ('cert_sync',                FALSE, NULL, NULL),
  ('dunning',                  FALSE, NULL, NULL),
  ('reminders',                FALSE, NULL, NULL),
  ('inbox_faq',                FALSE, 0.90, NULL),
  ('inbox_member',             FALSE, NULL, NULL)
ON CONFLICT (workflow) DO NOTHING;
