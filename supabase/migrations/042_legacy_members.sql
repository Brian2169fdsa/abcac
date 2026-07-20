-- Imported roster of existing ABCAC members (pre-platform records): names,
-- emails, credentials, cert numbers, and dates from the board's historical
-- database. Used to (a) verify self-reported credentials during account
-- approval, (b) drive the portal invite campaign, and (c) link claimed
-- accounts back to their source record.
CREATE TABLE IF NOT EXISTS public.legacy_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name       TEXT,
  last_name        TEXT,
  email            TEXT,
  phone            TEXT,
  cert_type        TEXT,          -- CAC / CADAC / AADC / CCS / CCJP / CPRS / CPS
  cert_number      TEXT,
  issued_date      DATE,
  expiration_date  DATE,
  ic_rc_level      TEXT,
  notes            TEXT,
  source_row       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- untouched original import row
  import_batch     TEXT NOT NULL,                       -- e.g. "2026-07-19-initial"
  invited_at       TIMESTAMPTZ,                         -- portal invite email sent
  claimed_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legacy_members_email ON public.legacy_members (lower(email));
CREATE INDEX IF NOT EXISTS idx_legacy_members_cert_number ON public.legacy_members (cert_number);
CREATE INDEX IF NOT EXISTS idx_legacy_members_claimed ON public.legacy_members (claimed_by);

ALTER TABLE public.legacy_members ENABLE ROW LEVEL SECURITY;

-- Staff-only data: contains PII for people who may never create accounts.
DROP POLICY IF EXISTS "admin_all_legacy_members" ON public.legacy_members;
CREATE POLICY "admin_all_legacy_members" ON public.legacy_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
