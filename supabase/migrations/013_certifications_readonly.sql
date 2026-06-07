-- ABCAC — RESTRICT MEMBER ACCESS TO certifications (privilege-escalation fix)
--
-- GAP: migration 001 created
--   CREATE POLICY "members_own_certs" ON public.certifications
--     FOR ALL USING (auth.uid() = member_id);
-- A `FOR ALL` policy grants members INSERT/UPDATE/DELETE on their own
-- certification rows. The certifications table is the system of record for
-- ISSUED credentials — they are granted exclusively by ABCAC staff (admin
-- console / service role) after reviewing an application, and `sync_enabled`
-- is toggled only by the Stripe webhook (service role). The member portal only
-- ever READS this table (account/certifications, renewals, account dashboard).
--
-- With the old policy a member could, from the browser anon key:
--   * INSERT a fabricated active credential (cert_type, status='active',
--     expiration_date far in the future) they never earned;
--   * UPDATE their own row to extend expiration_date / change cert_number;
--   * UPDATE sync_enabled = true to enable Certification Sync without paying.
--
-- FIX (additive, safe): replace the member FOR ALL policy with a SELECT-only
-- policy. Admin writes (admin_all_certs) and the service-role webhook are
-- unaffected because they bypass / satisfy their own policies. Members keep
-- full read access to their own credentials.
--
-- NOTE: public.other_certifications (member-recorded EXTERNAL credentials) is
-- intentionally left member-writable — that table is filled in by members on
-- the portal "Experience & Credentials" page.

DROP POLICY IF EXISTS "members_own_certs" ON public.certifications;

CREATE POLICY "members_read_certs" ON public.certifications
  FOR SELECT USING (auth.uid() = member_id);
