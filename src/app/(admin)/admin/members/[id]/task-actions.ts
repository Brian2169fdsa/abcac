"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Task actions — the ClickUp replacement. Admins create/edit/complete/delete
// tasks either on a member's record (memberId set) or as a general internal
// staff to-do shown only in the Agent workspace's task queue (memberId null —
// member_tasks.member_id is nullable, migration 056). Every action RE-CHECKS
// the caller's portal_role server-side on the cookie-bound session — the
// client never carries authorization. Mirrors cockpit-actions.ts:
// requireCaller() → isAdminRole gate → createSupabaseAdminClient() write →
// admin_audit_log → revalidatePath.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

const VALID_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];
const VALID_PRIORITIES = ["low", "normal", "high"] as const;
type TaskPriority = (typeof VALID_PRIORITIES)[number];

/** Re-read the caller from the cookie session. Returns the user id + role. */
async function requireCaller(): Promise<
  | { ok: true; userId: string; role: string | null }
  | { ok: false; error: string }
> {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  return { ok: true, userId: user.id, role: profile?.portal_role ?? null };
}

/** Normalize an empty/whitespace date string to null; pass through otherwise. */
function normDate(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function normPriority(v: string | null | undefined): TaskPriority {
  return VALID_PRIORITIES.includes(v as TaskPriority) ? (v as TaskPriority) : "normal";
}

type TaskFields = {
  title: string;
  detail?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  visibleToMember?: boolean;
};

/** Always refresh the Agent workspace's task queue; also refresh the member page when there is one. */
function revalidateTaskViews(memberId: string | null) {
  if (memberId) revalidatePath(MEMBER_PAGE(memberId));
  revalidatePath("/admin/agent");
}

/**
 * Create a task, optionally attached to a member (null = a general internal
 * staff task, shown only in the Agent workspace). ADMIN-GATED. Sets
 * `created_by` to the caller. `completed_at` is left to the DB trigger.
 */
export async function createMemberTask(
  memberId: string | null,
  fields: TaskFields,
): Promise<ActionResult> {
  const title = (fields.title ?? "").trim();
  if (!title) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("member_tasks")
    .insert({
      member_id: memberId,
      title,
      detail: (fields.detail ?? "").trim() || null,
      due_date: normDate(fields.dueDate),
      priority: normPriority(fields.priority),
      visible_to_member: memberId ? Boolean(fields.visibleToMember) : false,
      status: "open",
      created_by: caller.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "task_created",
      target_table: "member_tasks",
      target_id: data?.id ?? null,
      details: { member_id: memberId, title },
    });
  } catch {
    /* best-effort */
  }

  revalidateTaskViews(memberId);
  return { ok: true };
}

/**
 * Set a task's status. ADMIN-GATED. Does NOT set `completed_at` — a BEFORE UPDATE
 * trigger stamps it when status transitions to 'done'.
 */
export async function setMemberTaskStatus(
  taskId: string,
  memberId: string | null,
  status: string,
): Promise<ActionResult> {
  if (!taskId) return { ok: false, error: "bad_request" };
  if (!VALID_STATUSES.includes(status as TaskStatus)) {
    return { ok: false, error: "bad_request" };
  }

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const query = admin.from("member_tasks").update({ status }).eq("id", taskId);
  const { error } = await (memberId ? query.eq("member_id", memberId) : query.is("member_id", null));
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "task_status_changed",
      target_table: "member_tasks",
      target_id: taskId,
      details: { member_id: memberId, status },
    });
  } catch {
    /* best-effort */
  }

  revalidateTaskViews(memberId);
  return { ok: true };
}

/**
 * Edit a task's fields. ADMIN-GATED. Validates a non-empty title.
 */
export async function updateMemberTask(
  taskId: string,
  memberId: string | null,
  fields: TaskFields,
): Promise<ActionResult> {
  const title = (fields.title ?? "").trim();
  if (!taskId || !title) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const query = admin
    .from("member_tasks")
    .update({
      title,
      detail: (fields.detail ?? "").trim() || null,
      due_date: normDate(fields.dueDate),
      priority: normPriority(fields.priority),
      visible_to_member: memberId ? Boolean(fields.visibleToMember) : false,
    })
    .eq("id", taskId);
  const { error } = await (memberId ? query.eq("member_id", memberId) : query.is("member_id", null));
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "task_updated",
      target_table: "member_tasks",
      target_id: taskId,
      details: { member_id: memberId, title },
    });
  } catch {
    /* best-effort */
  }

  revalidateTaskViews(memberId);
  return { ok: true };
}

/**
 * Delete a task. ADMIN-GATED.
 */
export async function deleteMemberTask(
  taskId: string,
  memberId: string | null,
): Promise<ActionResult> {
  if (!taskId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const query = admin.from("member_tasks").delete().eq("id", taskId);
  const { error } = await (memberId ? query.eq("member_id", memberId) : query.is("member_id", null));
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "task_deleted",
      target_table: "member_tasks",
      target_id: taskId,
      details: { member_id: memberId },
    });
  } catch {
    /* best-effort */
  }

  revalidateTaskViews(memberId);
  return { ok: true };
}
