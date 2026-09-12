-- ABCAC — general (non-member) staff tasks in the AI Agent task queue.
--
-- member_tasks required member_id, so every task had to be attached to a
-- member — there was no way for staff to jot down an internal to-do ("renew
-- the SSL cert", "prep board meeting agenda") that isn't about any one
-- member. member_id becomes nullable so the Agent workspace's task queue can
-- hold both kinds side by side. RLS is unaffected: admin_all_member_tasks
-- already grants admins full access regardless of member_id, and the
-- member-visibility policy (auth.uid() = member_id) naturally never matches
-- a null member_id, so a general task is never exposed to any member.

ALTER TABLE public.member_tasks
  ALTER COLUMN member_id DROP NOT NULL;
