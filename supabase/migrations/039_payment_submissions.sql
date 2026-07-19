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
