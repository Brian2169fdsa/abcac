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
