-- ABCAC — MEMBER TASKS (admin-managed to-dos that replace ClickUp)
-- A lightweight task/note record an admin attaches to a member: title, detail,
-- due date, priority, status. Optionally visible to the member so it shows up
-- in their portal. Admins manage everything; members may only READ their own
-- tasks that are explicitly marked visible.
--
-- Applied to the live DB via the Supabase Management API. Idempotent.

CREATE TABLE IF NOT EXISTS public.member_tasks (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  detail             TEXT,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority           TEXT NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('low', 'normal', 'high')),
  due_date           DATE,
  visible_to_member  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         UUID REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_member_tasks_member ON public.member_tasks(member_id);
CREATE INDEX IF NOT EXISTS idx_member_tasks_status ON public.member_tasks(status);

ALTER TABLE public.member_tasks ENABLE ROW LEVEL SECURITY;

-- Admins (and superadmins, via is_admin()) manage every task.
DROP POLICY IF EXISTS "admin_all_member_tasks" ON public.member_tasks;
CREATE POLICY "admin_all_member_tasks" ON public.member_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Members may READ only their own tasks that are explicitly shared with them.
DROP POLICY IF EXISTS "members_read_visible_tasks" ON public.member_tasks;
CREATE POLICY "members_read_visible_tasks" ON public.member_tasks
  FOR SELECT USING (auth.uid() = member_id AND visible_to_member = TRUE);

-- Keep updated_at fresh and stamp completed_at when a task is closed.
CREATE OR REPLACE FUNCTION public.touch_member_task()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := NOW();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_member_task ON public.member_tasks;
CREATE TRIGGER tr_touch_member_task
  BEFORE UPDATE ON public.member_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_member_task();
