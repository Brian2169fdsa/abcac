-- The original ABCAC pre-registration form lets candidates check the specific
-- accommodations they need (Extended Time, Separate Room, Reader, ...). Store
-- the selected list on the request so staff see exactly what to arrange.
ALTER TABLE public.testing_requests
  ADD COLUMN IF NOT EXISTS accommodations_detail TEXT;
