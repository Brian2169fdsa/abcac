-- ABCAC: apply the three migrations missing from the live database (verified 2026-07-19).
-- Paste this whole file into the Supabase SQL editor (project ajgqqfggdctmcqhbmptb) and run it once.
-- All statements are additive (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS) and safe to re-run.

-- ============ 037_application_signer_requests.sql ============
-- External supervisors and attestors can complete their assigned portion of an
-- applicant's exact ABCAC form packet without receiving portal access.
CREATE TABLE IF NOT EXISTS public.application_signer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  form_key TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'opened', 'signed', 'revoked')),
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_name TEXT,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  opened_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_signer_requests_application
  ON public.application_signer_requests(application_id);
CREATE INDEX IF NOT EXISTS idx_application_signer_requests_member
  ON public.application_signer_requests(member_id);

ALTER TABLE public.application_signer_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_application_signer_request_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "members_view_own_signer_requests" ON public.application_signer_requests;
CREATE POLICY "members_view_own_signer_requests"
  ON public.application_signer_requests FOR SELECT
  USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "admins_manage_signer_requests" ON public.application_signer_requests;
CREATE POLICY "admins_manage_signer_requests"
  ON public.application_signer_requests FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS tr_application_signer_requests_updated_at ON public.application_signer_requests;
CREATE TRIGGER tr_application_signer_requests_updated_at
  BEFORE UPDATE ON public.application_signer_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_application_signer_request_updated_at();

-- ============ 038_testing_preregistration.sql ============
-- ABCAC exam pre-registration workflow.
-- Members submit through the portal; payment is reconciled by Stripe; staff
-- complete the SMT pre-registration and publish the result back to the member.

CREATE TABLE IF NOT EXISTS public.testing_requests (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purchaser_first_name       TEXT NOT NULL,
  purchaser_last_name        TEXT NOT NULL,
  purchaser_email            TEXT NOT NULL,
  purchaser_phone            TEXT NOT NULL,
  purchaser_address          TEXT NOT NULL,
  purchaser_date_of_birth    DATE NOT NULL,
  exam_code                  TEXT NOT NULL CHECK (exam_code IN ('ADC','AADC','CS','CCJP','PR','PS')),
  testing_mode               TEXT NOT NULL CHECK (testing_mode IN ('in_person','remote')),
  testing_location           TEXT,
  seeks_abcac_credential     BOOLEAN NOT NULL DEFAULT FALSE,
  credential_level           TEXT,
  azbbhe_approved            BOOLEAN NOT NULL DEFAULT FALSE,
  paying_for_other           BOOLEAN NOT NULL DEFAULT FALSE,
  tester_first_name          TEXT NOT NULL,
  tester_last_name           TEXT NOT NULL,
  tester_email               TEXT NOT NULL,
  tester_address             TEXT NOT NULL,
  tester_date_of_birth       DATE NOT NULL,
  accommodations_requested  BOOLEAN NOT NULL DEFAULT FALSE,
  supporting_documents      JSONB NOT NULL DEFAULT '[]'::JSONB
                               CHECK (jsonb_typeof(supporting_documents) = 'array'),
  status                     TEXT NOT NULL DEFAULT 'awaiting_payment'
                               CHECK (status IN ('awaiting_payment','paid','processing','pre_registered','on_hold','cancelled')),
  payment_status             TEXT NOT NULL DEFAULT 'unpaid'
                               CHECK (payment_status IN ('unpaid','paid','refunded')),
  stripe_session_id          TEXT,
  smt_candidate_id           TEXT,
  smt_notes                  TEXT,
  admin_notes                TEXT,
  submitted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at                    TIMESTAMPTZ,
  preregistered_at           TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testing_requests_member_created
  ON public.testing_requests(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testing_requests_queue
  ON public.testing_requests(status, submitted_at DESC);

ALTER TABLE public.testing_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_own_testing_requests" ON public.testing_requests;
CREATE POLICY "members_read_own_testing_requests" ON public.testing_requests
  FOR SELECT USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "admin_all_testing_requests" ON public.testing_requests;
CREATE POLICY "admin_all_testing_requests" ON public.testing_requests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_testing_request()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_testing_request ON public.testing_requests;
CREATE TRIGGER tr_touch_testing_request
  BEFORE UPDATE ON public.testing_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_testing_request();

-- ============ 039_payment_submissions.sql ============
-- Every Stripe payment must be backed by a persisted form/intake record.
-- Specialized workflows retain their own tables; this record links the charge
-- to that workflow and gives Finance one consistent place to inspect payer data.

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  form_type              TEXT NOT NULL,
  linked_record_type     TEXT,
  linked_record_id       UUID,
  product_slug           TEXT NOT NULL,
  product_name           TEXT NOT NULL,
  payer_first_name       TEXT NOT NULL,
  payer_last_name        TEXT NOT NULL,
  payer_email            TEXT NOT NULL,
  payer_phone            TEXT NOT NULL,
  credential_level       TEXT,
  exam_mode              TEXT,
  reference_number       TEXT,
  notes                  TEXT,
  form_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                 TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'checkout_created', 'paid', 'cancelled', 'refunded')),
  stripe_session_id      TEXT,
  amount_cents           INTEGER,
  currency               TEXT NOT NULL DEFAULT 'usd',
  paid_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_member_created
  ON public.payment_submissions(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status_created
  ON public.payment_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_linked_record
  ON public.payment_submissions(linked_record_type, linked_record_id);

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_own_payment_submissions" ON public.payment_submissions;
CREATE POLICY "members_read_own_payment_submissions" ON public.payment_submissions
  FOR SELECT USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "admin_all_payment_submissions" ON public.payment_submissions;
CREATE POLICY "admin_all_payment_submissions" ON public.payment_submissions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_submission_id UUID
    REFERENCES public.payment_submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_payment_submission
  ON public.payments(payment_submission_id);

CREATE OR REPLACE FUNCTION public.touch_payment_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_payment_submission ON public.payment_submissions;
CREATE TRIGGER tr_touch_payment_submission
  BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_submission();

