-- ABCAC — AUDIT LOG: make automation a first-class actor
-- Extends the existing admin_audit_log so an automated decision records who/what
-- acted, the decision tier + confidence, the deterministic rule / model version,
-- a link to its automation_runs row, the human approver (when a proposal was
-- approved), and before/after payloads. Defensibility: every consequential row
-- carries either a rule_version (a deterministic rule fired) or an approved_by
-- (a human signed off) — nothing irreversible on a bare model guess.
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS actor_type        TEXT NOT NULL DEFAULT 'human',  -- human | system | agent
  ADD COLUMN IF NOT EXISTS decision_tier     TEXT,
  ADD COLUMN IF NOT EXISTS confidence        NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS rule_version      TEXT,
  ADD COLUMN IF NOT EXISTS model_version     TEXT,
  ADD COLUMN IF NOT EXISTS automation_run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payload_before    JSONB,
  ADD COLUMN IF NOT EXISTS payload_after     JSONB;
