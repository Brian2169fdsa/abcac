-- ABCAC — verification decision letter storage path.
--
-- Deciding a verification request (Verified / Not Verified) today only sends
-- an inline-HTML email to the requester and updates the row's status — there
-- is no downloadable artifact, and a member-submitted request never notifies
-- the member themselves (only the third-party recipient/requester email).
-- This column records where the generated PDF letter was uploaded in the
-- existing private member-documents bucket, so the member can view/download
-- it from their own Requests page (mirrors name_change_requests.doc_path).
-- Nullable and additive: public (member-less) requests have no member folder
-- to store into, so letter_path stays null for those.

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS letter_path TEXT;
