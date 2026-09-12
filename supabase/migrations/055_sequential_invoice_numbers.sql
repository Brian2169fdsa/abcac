-- ABCAC — sequential invoice numbers.
--
-- Both invoice-creation entry points (the admin Create Invoice form and the
-- AI assistant's create_invoice tool) generated invoice_number client-side as
-- "INV-" + Date.now().toString(36) — not sequential, not guaranteed collision
-- free under concurrent creation, and not the kind of numbering a finance
-- office expects. A DB sequence + BEFORE INSERT trigger makes this atomic and
-- authoritative regardless of which caller creates the row, and callers no
-- longer need to compute or supply invoice_number at all.

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_invoice_number ON public.invoices;
CREATE TRIGGER tr_set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();
