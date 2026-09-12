-- ABCAC — notify the applicant when an outside signer completes their section.
--
-- 048 closed the loop for staff decisions, but an applicant who invited a
-- supervisor/evaluator/reference to sign a section of their packet never
-- heard back when that signer actually completed it — they had to keep
-- reopening the workspace to check. Same create_notification() helper as 034/048.

CREATE OR REPLACE FUNCTION public.notify_on_signer_signed() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed' THEN
    PERFORM public.create_notification(
      NEW.member_id, 'application',
      'Signer completed: ' || COALESCE(NEW.signer_name, 'Your signer'),
      COALESCE(NEW.signer_name, 'Your signer') || ' (' || COALESCE(NEW.signer_role, 'signer') || ') signed their section of your application packet.',
      '/account/applications');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_signer_signed ON public.application_signer_requests;
CREATE TRIGGER trg_notify_signer_signed AFTER UPDATE OF status ON public.application_signer_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_signer_signed();
