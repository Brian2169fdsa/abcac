-- ABCAC — WEBSITE INTEGRATION MIGRATION (additive only)
-- Connects the public website's commerce + contact flows to the existing portal
-- database. No existing columns are dropped or renamed.

-- ───────────────────────────────────────────────────────────
-- 1. PAYMENTS — self-serve store/Stripe purchases from the website
--    (admin-issued bills stay in `invoices`). member_id = profiles.id = auth uid.
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  stripe_event_id   TEXT UNIQUE,            -- idempotency guard for the webhook
  slug              TEXT,
  product_name      TEXT,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'usd',
  mode              TEXT NOT NULL DEFAULT 'payment',  -- payment | subscription
  credential_level  TEXT,
  exam_mode         TEXT,
  application_id    UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'paid',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_member ON public.payments(member_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_own_payments" ON public.payments
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "admin_all_payments" ON public.payments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Inserts come from the Stripe webhook using the service-role key (bypasses RLS).

-- ───────────────────────────────────────────────────────────
-- 2. CERTIFICATION SYNC flag (for the $15/mo Certification Sync subscription)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ───────────────────────────────────────────────────────────
-- 3. CONTACT MESSAGES — public website contact form fallback
--    (used when RESEND_API_KEY is not configured)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_contact" ON public.contact_messages
  FOR SELECT USING (public.is_admin());
-- Inserts come from the contact API using the service-role key (bypasses RLS).
