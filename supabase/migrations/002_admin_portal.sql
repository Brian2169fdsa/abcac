-- ABCAC MEMBER PORTAL — ADMIN PORTAL MIGRATION
-- Adds: admin role helper, admin-wide RLS policies, admin audit log,
-- storage bucket creation + admin read access.
-- Privileged writes are enforced server-side by Postgres RLS keyed on
-- profiles.portal_role = 'admin' (the role travels in the user's JWT-backed
-- session, so it cannot be spoofed from the browser).

-- ───────────────────────────────────────────────────────────
-- 1. ADMIN HELPER  (SECURITY DEFINER bypasses RLS → no recursion)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND portal_role = 'admin'
  );
$$;

-- ───────────────────────────────────────────────────────────
-- 2. ADMIN AUDIT LOG  (accountability for every privileged action)
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  target_table TEXT,
  target_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_audit_rw" ON public.admin_audit_log
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ───────────────────────────────────────────────────────────
-- 3. ADMIN-WIDE RLS POLICIES
--    Permissive policies are OR-ed with the existing member
--    policies, so members keep "own rows only" and admins get all.
-- ───────────────────────────────────────────────────────────
CREATE POLICY "admin_all_profiles"        ON public.profiles               FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_certs"           ON public.certifications         FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_ceu"             ON public.ceu_records            FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_docs"            ON public.documents              FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_employment"      ON public.employment_records     FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_other_certs"     ON public.other_certifications   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_supervision"     ON public.supervision_records    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_applications"    ON public.applications           FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_name_change"     ON public.name_change_requests   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_verifications"   ON public.verification_requests  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_reciprocity"     ON public.reciprocity_requests   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_messages"        ON public.messages               FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_invoices"        ON public.invoices               FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_all_prefs"           ON public.notification_preferences FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ───────────────────────────────────────────────────────────
-- 4. STORAGE BUCKETS  (idempotent — fixes missing name-change bucket)
-- ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-documents', 'member-documents', false),
       ('ceu-certificates',  'ceu-certificates',  false),
       ('name-change-docs',  'name-change-docs',  false)
ON CONFLICT (id) DO NOTHING;

-- Member upload/read for name-change-docs (matches the other two buckets)
CREATE POLICY "member_upload_namechange" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'name-change-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "member_read_namechange" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'name-change-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read every member's uploaded files (for review queues)
CREATE POLICY "admin_read_all_storage" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('member-documents', 'ceu-certificates', 'name-change-docs')
    AND public.is_admin()
  );

-- ───────────────────────────────────────────────────────────
-- 5. PROMOTE THE FIRST ADMIN
--    Run ONE of these in the Supabase SQL editor after the account exists:
--      UPDATE public.profiles SET portal_role = 'admin'
--      WHERE email = 'abcac@abcac.org';
-- ───────────────────────────────────────────────────────────
