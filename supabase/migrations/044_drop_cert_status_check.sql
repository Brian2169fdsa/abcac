-- The live DB carries a pre-repo CHECK constraint allowing only the three
-- signup choices (applying / active_holder / reciprocity_transfer). The repo
-- schema treats cert_status as free text, and the legacy provisioning flow
-- records inactive members as 'former_holder' — which this constraint
-- rejected, failing account creation for every inactive legacy member.
-- Drop it to match the repo schema (cert_status is trigger/admin-controlled).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cert_status_check;
