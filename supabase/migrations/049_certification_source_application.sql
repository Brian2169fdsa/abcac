-- ABCAC — link an issued certification back to the application that earned it.
--
-- Approving an initial or renewal application never created the credential;
-- staff had to separately remember to use "Issue a certification" with no
-- link back to which application it was for. This column lets the admin UI
-- surface "this approved application still needs its certificate issued" and
-- records the traceable link once it is. Nullable and additive — every
-- existing certification row is simply untagged (issued outside this flow,
-- e.g. the legacy-member import).

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS source_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_certifications_source_application
  ON public.certifications (source_application_id)
  WHERE source_application_id IS NOT NULL;
