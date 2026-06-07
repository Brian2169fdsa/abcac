-- ABCAC — 017_reciprocity_requests.sql
-- IC&RC RECIPROCITY — full OUT-of-Arizona and INTO-Arizona flows.
--
-- The reciprocity_requests table already exists (001) with:
--   member_id, direction ('out_of_az'|'into_az'), credential, destination,
--   reason, status, submitted_at, reviewed_at.
--
-- This migration is ADDITIVE and idempotent — it does not drop/rename anything.
-- It adds the columns the OUT/INTO flows and the admin decision need:
--
--   OUT of Arizona (member-initiated, carries the $150 IC&RC fee, card-only):
--     * destination_board_email — the email of the receiving IC&RC member board
--       that ABCAC must notify when the transfer is approved.
--     * fee_cents / payment_status / stripe_session_id — the $150 fee tracking.
--
--   INTO Arizona (inbound notice — no fee):
--     * origin_board / origin_board_email — where the credential is coming from.
--
--   Admin decision write-back (both directions):
--     * admin_notes — free-text reviewer note / denial reason.
--     * decided_at  — when the admin approved/denied.
--     * reviewed_by — the admin profile id that made the decision.
--
-- All new columns are NULLABLE / DEFAULTED so existing rows and the existing
-- member INSERT path keep working unchanged.

ALTER TABLE public.reciprocity_requests
  ADD COLUMN IF NOT EXISTS direction              TEXT,             -- belt-and-suspenders if an older copy lacks it
  ADD COLUMN IF NOT EXISTS destination_board_email TEXT,            -- OUT: receiving board notified on approval
  ADD COLUMN IF NOT EXISTS origin_board            TEXT,            -- INTO: sending board name
  ADD COLUMN IF NOT EXISTS origin_board_email      TEXT,            -- INTO: sending board contact (optional)
  ADD COLUMN IF NOT EXISTS fee_cents               INTEGER NOT NULL DEFAULT 0,   -- OUT: 15000 ($150); INTO: 0
  ADD COLUMN IF NOT EXISTS payment_status          TEXT NOT NULL DEFAULT 'none', -- none|unpaid|paid
  ADD COLUMN IF NOT EXISTS stripe_session_id       TEXT,            -- OUT: Stripe Checkout session id
  ADD COLUMN IF NOT EXISTS admin_notes             TEXT,            -- reviewer note / denial reason
  ADD COLUMN IF NOT EXISTS decided_at              TIMESTAMPTZ,     -- approve/deny timestamp
  ADD COLUMN IF NOT EXISTS reviewed_by             UUID REFERENCES public.profiles(id);

-- Helpful admin-queue index (pending first, newest first).
CREATE INDEX IF NOT EXISTS idx_reciprocity_status ON public.reciprocity_requests (status, submitted_at DESC);

-- ───────────────────────────────────────────────────────────
-- RLS — TIGHT. reciprocity_requests already has (001/002):
--   members_own_reciprocity  FOR ALL  USING (auth.uid() = member_id)
--   admin_all_reciprocity    FOR ALL  USING (public.is_admin()) WITH CHECK (public.is_admin())
--
-- The member FOR ALL policy from 001 lacks a WITH CHECK, which under Postgres
-- means INSERT/UPDATE are permitted for any row the USING clause would allow —
-- but it does NOT constrain the member_id a member may write. We tighten that
-- here so a member can only ever write rows attributed to themselves, and can
-- never set the admin-decision columns. Admin writes (service role / is_admin)
-- are unaffected.
-- ───────────────────────────────────────────────────────────

-- Re-create the member policy with an explicit WITH CHECK pinning member_id.
DROP POLICY IF EXISTS "members_own_reciprocity" ON public.reciprocity_requests;
CREATE POLICY "members_own_reciprocity" ON public.reciprocity_requests
  FOR ALL
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- BEFORE INSERT/UPDATE guard: for non-admin / non-service-role callers, force
-- the admin-decision + payment-authority columns back to safe values so a
-- member cannot self-approve, backdate a decision, or mark their own fee paid.
CREATE OR REPLACE FUNCTION public.guard_reciprocity_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the service role may write anything (admin decisions, webhook).
  IF public.is_admin() OR (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Member write: pin identity + the decision/payment-authority columns.
  NEW.member_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    -- A new member request is always pending and unreviewed.
    NEW.status        := COALESCE(NEW.status, 'pending');
    NEW.reviewed_at   := NULL;
    NEW.reviewed_by   := NULL;
    NEW.decided_at    := NULL;
    NEW.admin_notes   := NULL;
    -- Members cannot self-mark a fee as paid (only the Stripe webhook /
    -- service role may set payment_status='paid').
    IF NEW.payment_status = 'paid' THEN
      NEW.payment_status := 'unpaid';
    END IF;
  ELSE
    -- On member UPDATE, never let decision columns drift from their old values.
    NEW.status        := OLD.status;
    NEW.reviewed_at   := OLD.reviewed_at;
    NEW.reviewed_by   := OLD.reviewed_by;
    NEW.decided_at    := OLD.decided_at;
    NEW.admin_notes   := OLD.admin_notes;
    -- Members may not transition payment_status to 'paid' themselves.
    IF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid' THEN
      NEW.payment_status := OLD.payment_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_reciprocity_write ON public.reciprocity_requests;
CREATE TRIGGER tr_guard_reciprocity_write
  BEFORE INSERT OR UPDATE ON public.reciprocity_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_reciprocity_write();
