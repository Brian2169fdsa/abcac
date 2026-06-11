-- ABCAC — public credential verification + directory.
--
-- Outward-facing credential lookup: employers/boards confirm a counselor's
-- standing instantly. Privacy is enforced at the DB layer, not in app code:
--   1. members may OPT OUT of public listing (profiles.directory_opt_out),
--   2. a view exposes ONLY safe, non-PII columns (name + credential + status),
-- so a public page physically cannot select email/phone/DOB/SSN/address. The
-- view runs with owner privileges (bypasses table RLS) and is granted to anon,
-- so the public site can read it without the service role.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS directory_opt_out BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.directory_credentials AS
  SELECT
    c.cert_number,
    c.cert_type,
    c.status,
    c.issued_date,
    c.expiration_date,
    btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) AS full_name,
    p.last_name
  FROM public.certifications c
  JOIN public.profiles p ON p.id = c.member_id
  WHERE c.status = 'active'
    AND p.directory_opt_out = false
    AND c.cert_number IS NOT NULL
    AND btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) <> '';

-- Public read: the view's projection is the safety boundary.
GRANT SELECT ON public.directory_credentials TO anon, authenticated;
