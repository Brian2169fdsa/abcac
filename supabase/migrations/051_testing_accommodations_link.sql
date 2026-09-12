-- ABCAC — link a "Testing Special Accommodations Request" application back to
-- the specific exam pre-registration (testing_requests row) it is for.
--
-- testing_requests already carries its own quick accommodations_requested /
-- accommodations_detail checkboxes, but the more formal, signed PDF
-- "Testing Special Accommodations Request" is filed separately through the
-- digital application packet flow (applications.app_type = 'testing_accommodations').
-- That packet had no link back to which exam registration it applies to, so
-- staff reviewing it could not tell which upcoming exam (or testing mode) the
-- request was for. Nullable and additive: every other app_type simply leaves
-- this column null.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS testing_request_id UUID REFERENCES public.testing_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_testing_request
  ON public.applications (testing_request_id)
  WHERE testing_request_id IS NOT NULL;
