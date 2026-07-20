-- The board's master spreadsheet marks each person active (green) or inactive
-- (red), and carries mailing addresses. Carry both through the import so the
-- admin roster shows real standing and provisioning can fill member profiles.
ALTER TABLE public.legacy_members
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active',  -- active | inactive | review
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS state         TEXT,
  ADD COLUMN IF NOT EXISTS zip_code      TEXT;

CREATE INDEX IF NOT EXISTS idx_legacy_members_status ON public.legacy_members (status);
