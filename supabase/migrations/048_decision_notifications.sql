-- ABCAC — DECISION NOTIFICATIONS (member sees what staff decided)
--
-- 034 fans out in-app notifications for NEW invoices, document requests, member
-- tasks, and staff messages. Nothing fired when staff DECIDED something: a
-- document or CEU approved/rejected, an application moved through review, a
-- name-change / verification / reciprocity request decided, an account
-- approved, or a credential issued. Members had to keep re-opening pages to
-- find out. These AFTER UPDATE/INSERT triggers close that loop using the same
-- create_notification() helper, so human-admin and automation writes behave
-- identically. Idempotent.

-- ── Documents: status change ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_document_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','needs_revision') THEN
    PERFORM public.create_notification(
      NEW.member_id, 'documents',
      CASE NEW.status
        WHEN 'approved' THEN 'Document accepted: ' || COALESCE(NEW.document_type, NEW.file_name, 'document')
        WHEN 'rejected' THEN 'Document not accepted: ' || COALESCE(NEW.document_type, NEW.file_name, 'document')
        ELSE 'Document needs revision: ' || COALESCE(NEW.document_type, NEW.file_name, 'document')
      END,
      NEW.admin_notes,
      '/account/documents');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_document_status ON public.documents;
CREATE TRIGGER trg_notify_document_status AFTER UPDATE OF status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_document_status();

-- ── CEU records: status change ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_ceu_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.create_notification(
      NEW.member_id, 'certification',
      CASE NEW.status
        WHEN 'approved' THEN 'CEU approved: ' || COALESCE(NEW.course_name, 'course') || ' (' || COALESCE(NEW.hours::text, '?') || ' hrs)'
        ELSE 'CEU not approved: ' || COALESCE(NEW.course_name, 'course')
      END,
      NEW.admin_notes,
      '/account/ceus');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_ceu_status ON public.ceu_records;
CREATE TRIGGER trg_notify_ceu_status AFTER UPDATE OF status ON public.ceu_records
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ceu_status();

-- ── Applications: review stages ─────────────────────────────────────────────
-- (The Stripe webhook already notifies on submitted → under_review after a fee.
--  This covers staff-driven moves and the final decision.)
CREATE OR REPLACE FUNCTION public.notify_on_application_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('under_review','approved','rejected') THEN
    v_label := COALESCE(NEW.cert_type, replace(COALESCE(NEW.app_type, 'application'), '_', ' '));
    PERFORM public.create_notification(
      NEW.member_id, 'application',
      CASE NEW.status
        WHEN 'under_review' THEN 'Application under review: ' || v_label
        WHEN 'approved'     THEN 'Application approved: ' || v_label
        ELSE                     'Application decision: ' || v_label
      END,
      COALESCE(NEW.admin_notes,
        CASE NEW.status
          WHEN 'under_review' THEN 'ABCAC staff are reviewing your packet.'
          WHEN 'approved'     THEN 'Congratulations — your application was approved.'
          ELSE                     'Your application was not approved. Open Application Status for the reviewer note.'
        END),
      '/account/applications');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_application_status ON public.applications;
CREATE TRIGGER trg_notify_application_status AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_status();

-- ── Name-change requests ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_name_change_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','approved','rejected') THEN
    PERFORM public.create_notification(
      NEW.member_id, 'general',
      CASE WHEN NEW.status = 'rejected' THEN 'Name change not approved' ELSE 'Name change completed' END,
      COALESCE(NEW.admin_notes,
        CASE WHEN NEW.status = 'rejected' THEN 'ABCAC could not approve this request. See Requests for details.'
             ELSE 'Your record now shows ' || COALESCE(NEW.new_name, 'your new name') || '.' END),
      '/account/requests#name-change');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_name_change_status ON public.name_change_requests;
CREATE TRIGGER trg_notify_name_change_status AFTER UPDATE OF status ON public.name_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_name_change_status();

-- ── Verification requests ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_verification_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','rejected') THEN
    PERFORM public.create_notification(
      NEW.member_id, 'certification',
      'Verification request ' || CASE WHEN NEW.status = 'rejected' THEN 'declined' ELSE 'completed' END,
      CASE WHEN NEW.status = 'rejected' THEN 'ABCAC could not complete this verification. See Requests for details.'
           ELSE 'ABCAC sent a certification verification to ' || COALESCE(NEW.recipient_name, 'the recipient') || '.' END,
      '/account/requests#verification');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_verification_status ON public.verification_requests;
CREATE TRIGGER trg_notify_verification_status AFTER UPDATE OF status ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_verification_status();

-- ── Reciprocity requests ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_reciprocity_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','completed','rejected','denied') THEN
    PERFORM public.create_notification(
      NEW.member_id, 'certification',
      'Reciprocity request ' || CASE WHEN NEW.status IN ('rejected','denied') THEN 'not approved' ELSE 'approved' END,
      COALESCE(NEW.admin_notes,
        CASE WHEN NEW.status IN ('rejected','denied') THEN 'ABCAC could not approve this transfer. See Requests for details.'
             ELSE 'Your IC&RC reciprocity transfer was approved.' END),
      '/account/requests#reciprocity');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_reciprocity_status ON public.reciprocity_requests;
CREATE TRIGGER trg_notify_reciprocity_status AFTER UPDATE OF status ON public.reciprocity_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reciprocity_status();

-- ── Account approval ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_account_status() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    IF NEW.account_status = 'approved' THEN
      PERFORM public.create_notification(NEW.id, 'general',
        'Your ABCAC account is approved',
        'Welcome — every part of the member portal is now open to you.',
        '/account');
    ELSIF NEW.account_status = 'rejected' THEN
      PERFORM public.create_notification(NEW.id, 'general',
        'Account review update',
        COALESCE(NEW.account_review_notes, 'ABCAC needs more information before approving your account.'),
        '/account/onboarding');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_account_status ON public.profiles;
CREATE TRIGGER trg_notify_account_status AFTER UPDATE OF account_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_account_status();

-- ── Credential issued / renewed ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_certification_issued() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.member_id, 'certification',
      'Credential issued: ' || COALESCE(NEW.cert_type, 'ABCAC credential'),
      'Your certificate and wallet card are ready to download.',
      '/account/certifications');
  ELSIF TG_OP = 'UPDATE' AND NEW.expiration_date IS DISTINCT FROM OLD.expiration_date
        AND NEW.status = 'active' AND NEW.expiration_date > COALESCE(OLD.expiration_date, DATE '1900-01-01') THEN
    PERFORM public.create_notification(NEW.member_id, 'certification',
      'Credential renewed: ' || COALESCE(NEW.cert_type, 'ABCAC credential'),
      'New expiration date: ' || to_char(NEW.expiration_date, 'Mon DD, YYYY') || '. Your updated certificate is ready to download.',
      '/account/certifications');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_certification_issued ON public.certifications;
CREATE TRIGGER trg_notify_certification_issued AFTER INSERT OR UPDATE OF expiration_date, status ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_certification_issued();
