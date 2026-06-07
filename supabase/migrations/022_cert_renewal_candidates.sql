-- ABCAC — 022_cert_renewal_candidates.sql
-- CERT DUE-DATES ENGINE → who-is-due reporting surface.
--
-- Purpose: provide the single read surface the renewal-alerts automation
-- (n8n `ABCAC-01-RENEWAL-ALERTS`, which calls
--   …/rest/v1/rpc/cert_renewal_candidates) and any future dashboard needs:
-- a row per ACTIVE certification that is approaching (or past) its renewal
-- due date, enriched with the credential's cert_schedules rules, the member's
-- approved-CEU progress, and the member's renewal-reminder opt-in.
--
-- Design:
--   * Implemented as a SECURITY DEFINER set-returning function (RPC) named
--     public.cert_renewal_candidates() so PostgREST exposes it at
--     /rest/v1/rpc/cert_renewal_candidates exactly as the n8n workflow expects.
--   * A companion VIEW public.cert_renewal_candidates_v wraps the same query so
--     it can also be SELECTed directly by admins.
--   * The function is callable only by admins / service-role (n8n uses the
--     service-role key); the view is admin-gated via security_invoker + the
--     existing admin RLS on the underlying tables.
--
-- Additive only. Single source of truth stays Supabase: every figure is derived
-- from REAL state (certifications.expiration_date + cert_schedules rules +
-- ceu_records + notification_preferences). No per-member due dates are stored.
--
-- Tier semantics mirror src/lib/schedules.ts tierForDays():
--   days_until_due < 0           → 'overdue'   (note: may still be in grace)
--   = 0                          → 'due'
--   1..7                         → '7-day'
--   8..30                        → '30-day'
--   31..60                       → '60-day'
--   61..90                       → '90-day'
--   > 90                         → 'ok'

-- ---------------------------------------------------------------------------
-- Core query, exposed both as a view and as an RPC.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.cert_renewal_candidates_v
WITH (security_invoker = true) AS
WITH ceu_progress AS (
  SELECT
    member_id,
    COALESCE(SUM(hours), 0)                                               AS ceu_total_approved,
    COALESCE(SUM(hours) FILTER (WHERE category = 'Ethics'), 0)            AS ceu_ethics_approved,
    COALESCE(SUM(hours) FILTER (WHERE category = 'Cultural Diversity'), 0) AS ceu_cultural_approved
  FROM public.ceu_records
  WHERE status = 'approved'
  GROUP BY member_id
)
SELECT
  c.id                                   AS certification_id,
  c.member_id,
  p.email,
  p.first_name,
  p.last_name,
  c.cert_type                            AS credential_type,
  c.cert_number,
  c.expiration_date,
  -- Renewal rules (fall back to ABCAC defaults when no schedule row exists).
  COALESCE(s.renewal_cycle_months, 24)   AS renewal_cycle_months,
  COALESCE(s.ceu_total_required, 40)     AS ceu_total_required,
  COALESCE(s.ceu_ethics_required, 3)     AS ceu_ethics_required,
  COALESCE(s.ceu_cultural_required, 3)   AS ceu_cultural_required,
  COALESCE(s.grace_period_days, 0)       AS grace_period_days,
  -- The due date IS the stored expiration_date (single source of truth).
  c.expiration_date                      AS next_due_date,
  (c.expiration_date + COALESCE(s.grace_period_days, 0)) AS grace_end_date,
  (c.expiration_date - CURRENT_DATE)     AS days_until_due,
  -- Grace / lapse flags.
  (CURRENT_DATE > c.expiration_date
    AND CURRENT_DATE <= c.expiration_date + COALESCE(s.grace_period_days, 0)) AS in_grace_period,
  (CURRENT_DATE > c.expiration_date + COALESCE(s.grace_period_days, 0))       AS lapsed,
  -- Coarse reminder tier (mirrors src/lib/schedules.ts).
  CASE
    WHEN (c.expiration_date - CURRENT_DATE) < 0  THEN 'overdue'
    WHEN (c.expiration_date - CURRENT_DATE) = 0  THEN 'due'
    WHEN (c.expiration_date - CURRENT_DATE) <= 7  THEN '7-day'
    WHEN (c.expiration_date - CURRENT_DATE) <= 30 THEN '30-day'
    WHEN (c.expiration_date - CURRENT_DATE) <= 60 THEN '60-day'
    WHEN (c.expiration_date - CURRENT_DATE) <= 90 THEN '90-day'
    ELSE 'ok'
  END                                    AS tier,
  -- CEU progress vs requirement.
  COALESCE(cp.ceu_total_approved, 0)     AS ceu_total_approved,
  COALESCE(cp.ceu_ethics_approved, 0)    AS ceu_ethics_approved,
  COALESCE(cp.ceu_cultural_approved, 0)  AS ceu_cultural_approved,
  GREATEST(COALESCE(s.ceu_total_required, 40) - COALESCE(cp.ceu_total_approved, 0), 0)        AS ceu_total_remaining,
  (COALESCE(cp.ceu_total_approved, 0)    >= COALESCE(s.ceu_total_required, 40)
    AND COALESCE(cp.ceu_ethics_approved, 0)   >= COALESCE(s.ceu_ethics_required, 3)
    AND COALESCE(cp.ceu_cultural_approved, 0) >= COALESCE(s.ceu_cultural_required, 3)) AS ceu_compliant,
  -- Member opt-in (defaults to TRUE when no preferences row exists).
  COALESCE(np.renewal_reminders, TRUE)   AS renewal_reminders_opt_in,
  COALESCE(np.ceu_deadline_alerts, TRUE) AS ceu_deadline_alerts_opt_in
FROM public.certifications c
JOIN public.profiles p                ON p.id = c.member_id
LEFT JOIN public.cert_schedules s     ON lower(btrim(s.credential_type)) = lower(btrim(c.cert_type))
LEFT JOIN ceu_progress cp             ON cp.member_id = c.member_id
LEFT JOIN public.notification_preferences np ON np.member_id = c.member_id
WHERE c.status = 'active'
  AND c.expiration_date IS NOT NULL;

COMMENT ON VIEW public.cert_renewal_candidates_v IS
  'Active certifications enriched with cert_schedules rules, CEU progress, due-date tier, and member opt-in. Admin-gated via security_invoker.';

-- ---------------------------------------------------------------------------
-- RPC the n8n workflow calls. SECURITY DEFINER so the service-role (or an
-- admin) gets the full candidate set in one call. Accepts an optional
-- max_days_until_due filter (default 90) to limit to members approaching due.
-- ---------------------------------------------------------------------------

-- Drop any prior signature so the return-type can be (re)bound cleanly.
DROP FUNCTION IF EXISTS public.cert_renewal_candidates(integer);

CREATE FUNCTION public.cert_renewal_candidates(max_days_until_due integer DEFAULT 90)
RETURNS SETOF public.cert_renewal_candidates_v
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so gate it explicitly: only the service-role
  -- (the n8n caller) and admins may read the candidate set. Everyone else gets
  -- an error rather than other members' rows.
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN QUERY
      SELECT *
      FROM public.cert_renewal_candidates_v
      WHERE days_until_due <= max_days_until_due
      ORDER BY days_until_due ASC;
  ELSE
    RAISE EXCEPTION 'not authorized';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.cert_renewal_candidates(integer) IS
  'Renewal-alert candidates within max_days_until_due (default 90), past-due included. Called by n8n ABCAC-01-RENEWAL-ALERTS via /rest/v1/rpc/cert_renewal_candidates (service-role key). Admin/service-role only.';

REVOKE ALL ON FUNCTION public.cert_renewal_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cert_renewal_candidates(integer) TO authenticated, service_role;
