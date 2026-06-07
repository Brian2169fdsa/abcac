-- ABCAC — PUBLIC VERIFICATION REQUESTS + ONE-CLICK ADMIN DECISION
--
-- Two additive needs:
--   1. A PUBLIC (no-login) "Verify a Certification" form on the marketing site
--      must insert verification_requests rows. Today member_id is NOT NULL and
--      the only person/details captured assume a signed-in member. Public
--      requests have no member, and instead carry requester identity (name,
--      email, organization) + who they are verifying (counselor name and/or
--      cert number) + a reason.
--   2. The admin queue should make a one-click Verified / Not Verified decision
--      and record the outcome + a decided timestamp on the row.
--
-- This migration is ADDITIVE and idempotent. It does not drop or rename any
-- existing column. Existing member-portal verification requests keep working
-- unchanged (member_id still set, source defaults to 'portal').

-- 1. Allow public (member-less) requests: member_id becomes nullable.
ALTER TABLE public.verification_requests
  ALTER COLUMN member_id DROP NOT NULL;

-- 2. Public-request + decision columns (all nullable / defaulted).
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS source              TEXT NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS requester_name      TEXT,
  ADD COLUMN IF NOT EXISTS requester_email     TEXT,
  ADD COLUMN IF NOT EXISTS organization        TEXT,
  ADD COLUMN IF NOT EXISTS subject_name        TEXT,   -- counselor name being verified
  ADD COLUMN IF NOT EXISTS subject_cert_number TEXT,   -- counselor cert number being verified
  ADD COLUMN IF NOT EXISTS verification_result TEXT,    -- 'verified' | 'not_verified'
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ;

-- 3. RLS: the public form writes via the service-role admin client ONLY (the
--    /api/verification route). The service role bypasses RLS, so NO anon/public
--    INSERT policy is created here. We deliberately do NOT add a public SELECT
--    policy: anon users still cannot read verification_requests rows (others'
--    requester emails, member ids, outcomes stay private). The existing
--    members_own_verifications (SELECT/own) and admin_all_verifications (admin)
--    policies are unchanged and remain the only read/write paths besides the
--    service role.
--
-- (No policy statements required — absence of an anon policy with RLS enabled
--  means anon is denied by default. Documented here intentionally.)

-- 4. Helpful index for the admin queue ordering by source.
CREATE INDEX IF NOT EXISTS idx_verifications_source ON public.verification_requests (source);
