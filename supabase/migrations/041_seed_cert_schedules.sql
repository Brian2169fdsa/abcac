-- Activate the CEU tracker / renewal due-date engine: every ABCAC credential
-- renews on the standard 24-month cycle with 40 CE hours (3 Ethics + 3
-- Cultural Diversity). Adjust per-credential rows later if any differ.
INSERT INTO public.cert_schedules (credential_type)
VALUES ('CAC'), ('CADAC'), ('AADC'), ('CCS'), ('CCJP'), ('CPRS'), ('CPS')
ON CONFLICT (credential_type) DO NOTHING;
