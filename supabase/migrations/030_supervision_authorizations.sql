-- ABCAC — SUPERVISION AUTHORIZATIONS (closes the dangling-reference schema hole)
-- The admin member-detail page already reads `supervision_authorizations`, but
-- no migration ever created it. This is a board-granted record that a member is
-- authorized as a clinical supervisor (e.g. CCS) — analogous to certifications:
-- the board (admin) grants/edits it; the member sees it read-only.
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

CREATE TABLE IF NOT EXISTS public.supervision_authorizations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  authorization_type  TEXT NOT NULL,                 -- e.g. 'Clinical Supervisor (CCS)'
  detail              TEXT,                           -- scope / notes shown in the table
  start_date          DATE,
  end_date            DATE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervision_auth_member ON public.supervision_authorizations(member_id);

ALTER TABLE public.supervision_authorizations ENABLE ROW LEVEL SECURITY;

-- Members read their own authorizations only (board-granted → read-only for them).
DROP POLICY IF EXISTS "members_read_own_supervision_auth" ON public.supervision_authorizations;
CREATE POLICY "members_read_own_supervision_auth" ON public.supervision_authorizations
  FOR SELECT USING (auth.uid() = member_id);

-- Admins (and superadmins via is_admin()) manage all.
DROP POLICY IF EXISTS "admin_all_supervision_auth" ON public.supervision_authorizations;
CREATE POLICY "admin_all_supervision_auth" ON public.supervision_authorizations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.touch_supervision_auth()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_touch_supervision_auth ON public.supervision_authorizations;
CREATE TRIGGER tr_touch_supervision_auth
  BEFORE UPDATE ON public.supervision_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_supervision_auth();
