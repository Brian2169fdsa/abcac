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
