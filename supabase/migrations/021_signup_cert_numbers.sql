-- ABCAC — SIGNUP CERTIFICATION NUMBERS (additive, safe)
--
-- WHY: At signup, certificate holders (cert_status='active_holder' or
-- 'reciprocity_transfer') self-report the certification number(s) they already
-- hold so an admin can verify them before approving the account. Members CANNOT
-- insert into public.certifications (migration 013 made that table member-read-
-- only / SELECT — it is the system of record for ISSUED credentials, written
-- only by ABCAC staff / the service role). So the self-reported numbers are
-- captured as raw_user_meta_data at signUp and copied into a free-text profile
-- column the admin can read on /admin/approvals.
--
-- This migration is ADDITIVE: it adds one nullable TEXT column and re-creates
-- handle_new_user (based on the 007 version) to also copy
-- raw_user_meta_data->>'cert_numbers' into it. All prior trigger behavior
-- (profile create from metadata, account_status='pending', notification prefs)
-- is preserved unchanged.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS submitted_cert_numbers TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, first_name, last_name, phone, cert_status,
    account_status, submitted_cert_numbers
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'cert_status', 'applying'),
    'pending',
    NEW.raw_user_meta_data->>'cert_numbers'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (member_id)
  VALUES (NEW.id)
  ON CONFLICT (member_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
