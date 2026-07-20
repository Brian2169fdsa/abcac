-- Two more pre-repo live constraints that reject real historical data:
--
-- 1. certifications_cert_type_check (live DB only, in no repo migration)
--    allows only the modern credential list — but the board's historical
--    roster includes retired credential names (ADC, PS, CS, AAC, CAADAC,
--    CAC/ADC). Members must see the credential they actually held.
--
-- 2. cert_number is globally UNIQUE (001) — but historically numbers were
--    assigned per credential type, so e.g. PS #52 and AADC #52 are two
--    different, equally real certifications. Uniqueness belongs to the
--    (type, number) pair.
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_cert_type_check;
ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_cert_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS certifications_type_number_key
  ON public.certifications (cert_type, cert_number)
  WHERE cert_number IS NOT NULL;
