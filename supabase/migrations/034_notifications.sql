-- ABCAC — member notifications + activity feed.
--
-- A single in-app "what happened / what we need from you" stream for members.
-- Rows are fanned out by AFTER INSERT triggers on the tables that already
-- represent member-facing events (invoices, document_requests, member_tasks,
-- inbound messages), so BOTH human-admin and automation-engine origins produce
-- a notification uniformly — no app code or executor has to remember to emit.
-- The triggers run SECURITY DEFINER so they fire regardless of the writer's role.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('billing','documents','application','certification','message','announcement','general')),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member_created
  ON public.notifications (member_id, created_at DESC);
-- Partial index for the unread-count badge (the hot query).
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (member_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Members read and update (mark-read) only their own; admins see all. Inserts
-- come from the SECURITY DEFINER triggers / service role, never from members.
DROP POLICY IF EXISTS "members_read_notifications" ON public.notifications;
CREATE POLICY "members_read_notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "members_update_notifications" ON public.notifications;
CREATE POLICY "members_update_notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);

DROP POLICY IF EXISTS "admin_all_notifications" ON public.notifications;
CREATE POLICY "admin_all_notifications" ON public.notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Emit helper ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_member_id UUID,
  p_category  TEXT,
  p_title     TEXT,
  p_body      TEXT DEFAULT NULL,
  p_link      TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_member_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications (member_id, category, title, body, link)
  VALUES (p_member_id, COALESCE(p_category, 'general'), p_title, p_body, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Fan-out triggers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_invoice() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.member_id, 'billing',
    'New invoice ' || COALESCE(NEW.invoice_number, ''),
    COALESCE(NEW.description, 'A new invoice is available.'),
    '/account/invoices');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_invoice ON public.invoices;
CREATE TRIGGER trg_notify_invoice AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_invoice();

CREATE OR REPLACE FUNCTION public.notify_on_document_request() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.member_id, 'documents',
    'Document requested: ' || COALESCE(NEW.document_type, 'document'),
    COALESCE(NEW.note, 'We need a document to continue processing your file.'),
    '/account/documents');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_document_request ON public.document_requests;
CREATE TRIGGER trg_notify_document_request AFTER INSERT ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_document_request();

CREATE OR REPLACE FUNCTION public.notify_on_member_task() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.visible_to_member THEN
    PERFORM public.create_notification(
      NEW.member_id, 'general',
      COALESCE(NEW.title, 'New task'),
      NEW.detail,
      '/account');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_member_task ON public.member_tasks;
CREATE TRIGGER trg_notify_member_task AFTER INSERT ON public.member_tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_member_task();

-- Inbound messages only (a member's OWN composes carry sender_role='member').
CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_role IS DISTINCT FROM 'member' THEN
    PERFORM public.create_notification(
      NEW.member_id, 'message',
      'New message: ' || COALESCE(NEW.subject, ''),
      NEW.from_name,
      '/account/messages');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
