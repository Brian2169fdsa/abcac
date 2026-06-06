-- ABCAC — ACCOUNT APPROVAL WORKFLOW (additive, safe)
-- New self-registered certificate holders start as 'pending' and must be
-- approved by an admin. IMPORTANT: the column default is 'approved' so that all
-- EXISTING members (and the admin) are backfilled as approved and never locked
-- out — only NEW signups are set to 'pending' (in handle_new_user below).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status        TEXT NOT NULL DEFAULT 'approved', -- pending | approved | rejected
  ADD COLUMN IF NOT EXISTS account_submitted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_review_notes  TEXT;

-- New signups: populate profile from metadata AND mark the account 'pending'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, cert_status, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'cert_status', 'applying'),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (member_id)
  VALUES (NEW.id)
  ON CONFLICT (member_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
