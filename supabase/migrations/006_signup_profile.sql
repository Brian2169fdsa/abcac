-- ABCAC — SIGNUP PROFILE POPULATION (additive, safe CREATE OR REPLACE)
-- Enhances the existing new-user trigger to copy signup details from auth
-- metadata into the member's profile. Existing behavior (create profile +
-- notification prefs) is preserved.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, cert_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'cert_status', 'applying')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (member_id)
  VALUES (NEW.id)
  ON CONFLICT (member_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
