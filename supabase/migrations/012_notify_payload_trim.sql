-- ABCAC — TRIM PII FROM notify_events() PROFILES PAYLOAD
-- Re-creates notify_events() so that when the trigger fires on the profiles
-- table it sends only safe columns instead of to_jsonb(NEW) (which would
-- leak ssn_last4, date_of_birth, etc. into Edge Function logs).
-- All other tables continue to send the full NEW row as before.
-- The trigger definitions created in migration 003 are unchanged.

CREATE OR REPLACE FUNCTION public.notify_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  fn_url  TEXT;
  svc_key TEXT;
  body    JSONB;
BEGIN
  SELECT decrypted_secret INTO fn_url  FROM vault.decrypted_secrets WHERE name = 'edge_functions_url';
  SELECT decrypted_secret INTO svc_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF fn_url IS NULL OR svc_key IS NULL THEN
    RETURN NEW;  -- not configured yet; do nothing
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    -- Only send safe, non-PII columns for the profiles table.
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME,
      'record', jsonb_build_object('id', NEW.id, 'email', NEW.email,
        'first_name', NEW.first_name, 'last_name', NEW.last_name,
        'account_status', NEW.account_status, 'member_id', NEW.id));
  ELSE
    body := jsonb_build_object(
               'type', TG_OP,
               'table', TG_TABLE_NAME,
               'record', to_jsonb(NEW));
  END IF;

  PERFORM net.http_post(
    url     := fn_url || '/events',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || svc_key),
    body    := body
  );
  RETURN NEW;
END;
$$;
