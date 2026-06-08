"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole, isSuperadminRole, type PortalRole } from "@/lib/auth/roles";

// Member-detail "cockpit" actions that replace the ClickUp workflow with direct,
// audited operations on the member. Every action RE-CHECKS the caller's
// portal_role server-side on the cookie-bound session — the client boolean
// (`canManageRoles`) is only a UI hint and is NEVER trusted for authorization.
// Each action returns a discriminated result and revalidates the member page.

type ActionResult = { ok: true } | { ok: false; error: string };

const ROLE_PAGE = (memberId: string) => `/admin/members/${memberId}`;

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

/**
 * Send a message to a member. ADMIN-GATED. Mirrors send-message-form's insert
 * into `messages`, but performs the role re-check server-side and writes an
 * `admin_audit_log` entry.
 */
export async function sendMemberMessage(
  memberId: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  const trimmedSubject = (subject ?? "").trim();
  const trimmedBody = (body ?? "").trim();
  if (!memberId || !trimmedSubject) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("messages").insert({
    member_id: memberId,
    from_name: "ABCAC Admin",
    subject: trimmedSubject,
    body: trimmedBody || null,
    is_read: false,
  });
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "message_sent",
      target_table: "messages",
      target_id: null,
      details: { member_id: memberId, subject: trimmedSubject },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(ROLE_PAGE(memberId));
  return { ok: true };
}

/**
 * Request a document from a member. ADMIN-GATED. Mirrors request-document.tsx's
 * insert into `document_requests`, with a server-side role re-check and audit.
 */
export async function requestMemberDocument(
  memberId: string,
  documentType: string,
  note: string,
): Promise<ActionResult> {
  const trimmedType = (documentType ?? "").trim();
  const trimmedNote = (note ?? "").trim();
  if (!memberId || !trimmedType) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("document_requests").insert({
    member_id: memberId,
    document_type: trimmedType,
    note: trimmedNote || null,
    status: "open",
  });
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "document_requested",
      target_table: "document_requests",
      target_id: null,
      details: { member_id: memberId, document_type: trimmedType },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(ROLE_PAGE(memberId));
  return { ok: true };
}

const VALID_ROLES: PortalRole[] = ["member", "admin", "superadmin"];

/**
 * Change a member's portal_role. SUPERADMIN-GATED — only the "god account" can
 * mint/demote admins. The UPDATE runs through the caller's OWN cookie-bound
 * session client (not the service role): the database guard trigger permits the
 * write precisely because the caller is a superadmin, keeping the DB as the
 * source of truth. Refuses to change the caller's own role (anti self-lockout)
 * and audits the old→new transition.
 */
export async function changeMemberRole(
  memberId: string,
  newRole: string,
): Promise<ActionResult> {
  if (!memberId || !VALID_ROLES.includes(newRole as PortalRole)) {
    return { ok: false, error: "bad_request" };
  }

  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: callerProfile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isSuperadminRole(callerProfile?.portal_role)) {
    return { ok: false, error: "forbidden" };
  }

  // Anti self-lockout: a superadmin may not change their own role.
  if (memberId === user.id) return { ok: false, error: "cannot_change_self" };

  // Capture the prior role for the audit trail.
  const { data: target } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", memberId)
    .maybeSingle();
  if (!target) return { ok: false, error: "not_found" };
  const oldRole = target.portal_role ?? null;
  if (oldRole === newRole) return { ok: true };

  // Update via the caller's own session client — the DB guard trigger allows it
  // because the caller is a superadmin.
  const { error } = await sb
    .from("profiles")
    .update({ portal_role: newRole })
    .eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "role_changed",
      target_table: "profiles",
      target_id: memberId,
      details: { member_id: memberId, old_role: oldRole, new_role: newRole },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(ROLE_PAGE(memberId));
  return { ok: true };
}
