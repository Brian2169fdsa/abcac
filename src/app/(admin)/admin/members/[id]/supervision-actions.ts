"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Per-member supervision actions — closes parity gap B4. Admins manage the
// supervision RECORDS this member provides (the member is the supervisor) and
// the board-granted supervision AUTHORIZATIONS the member holds. Every action
// RE-CHECKS the caller's portal_role server-side on the cookie-bound session —
// the client never carries authorization. Mirrors cockpit-actions.ts /
// task-actions.ts: requireCaller() → isAdminRole gate → createSupabaseAdminClient()
// write → admin_audit_log → revalidatePath.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

const VALID_AUTH_STATUSES = ["active", "expired", "revoked", "pending"] as const;
type AuthStatus = (typeof VALID_AUTH_STATUSES)[number];

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

/** Normalize an empty/whitespace string to null; trim + pass through otherwise. */
function normText(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function normAuthStatus(v: string | null | undefined): AuthStatus {
  return VALID_AUTH_STATUSES.includes(v as AuthStatus) ? (v as AuthStatus) : "active";
}

// ───────────────────────────────────────────────────────────
// Supervision records (this member supervises others — supervisor_id = memberId)
// ───────────────────────────────────────────────────────────

type SupervisionRecordFields = {
  id?: string | null;
  superviseeName: string;
  superviseeCredential?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  superviseeMemberId?: string | null;
};

/**
 * Create or update a supervision record the member PROVIDES. ADMIN-GATED.
 * Always pins `supervisor_id = memberId`. On update, scopes by id AND
 * supervisor_id so an admin can never re-target another supervisor's row.
 */
export async function upsertSupervisionRecord(
  memberId: string,
  row: SupervisionRecordFields,
): Promise<ActionResult> {
  const superviseeName = (row.superviseeName ?? "").trim();
  if (!memberId || !superviseeName) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const payload = {
    supervisor_id: memberId,
    supervisee_name: superviseeName,
    supervisee_credential: normText(row.superviseeCredential),
    start_date: normText(row.startDate),
    end_date: normText(row.endDate),
    status: normText(row.status) ?? "active",
    supervisee_member_id: normText(row.superviseeMemberId),
  };

  const recordId = normText(row.id);
  if (recordId) {
    const { error } = await admin
      .from("supervision_records")
      .update(payload)
      .eq("id", recordId)
      .eq("supervisor_id", memberId);
    if (error) return { ok: false, error: error.message };
    await audit(admin, caller.userId, "supervision_record_updated", recordId, {
      member_id: memberId,
      supervisee_name: superviseeName,
    });
  } else {
    const { data, error } = await admin
      .from("supervision_records")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    await audit(admin, caller.userId, "supervision_record_created", data?.id ?? null, {
      member_id: memberId,
      supervisee_name: superviseeName,
    });
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Delete a supervision record the member provides. ADMIN-GATED. Scoped by id
 * AND supervisor_id = memberId.
 */
export async function deleteSupervisionRecord(
  memberId: string,
  id: string,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("supervision_records")
    .delete()
    .eq("id", id)
    .eq("supervisor_id", memberId);
  if (error) return { ok: false, error: error.message };

  await audit(admin, caller.userId, "supervision_record_deleted", id, { member_id: memberId });

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Link (or unlink) a supervisee's ABCAC member account to a supervision record —
 * the "link a supervisee" capability that the supervisee-side view needs.
 * ADMIN-GATED. Pass `null` to unlink. Scoped by id AND supervisor_id = memberId.
 */
export async function setSupervisee(
  memberId: string,
  recordId: string,
  superviseeMemberId: string | null,
): Promise<ActionResult> {
  if (!memberId || !recordId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const linked = normText(superviseeMemberId);
  // A member cannot be listed as their own supervisee.
  if (linked && linked === memberId) return { ok: false, error: "cannot_link_self" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("supervision_records")
    .update({ supervisee_member_id: linked })
    .eq("id", recordId)
    .eq("supervisor_id", memberId);
  if (error) return { ok: false, error: error.message };

  await audit(admin, caller.userId, "supervisee_linked", recordId, {
    member_id: memberId,
    supervisee_member_id: linked,
  });

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

// ───────────────────────────────────────────────────────────
// Supervision authorizations (board-granted; admin manages — member_id = memberId)
// ───────────────────────────────────────────────────────────

type AuthorizationFields = {
  id?: string | null;
  authorizationType: string;
  detail?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  adminNotes?: string | null;
};

/**
 * Create or update a supervision authorization the member HOLDS. ADMIN-GATED.
 * Always pins `member_id = memberId`. On update, scopes by id AND member_id.
 */
export async function upsertAuthorization(
  memberId: string,
  row: AuthorizationFields,
): Promise<ActionResult> {
  const authorizationType = (row.authorizationType ?? "").trim();
  if (!memberId || !authorizationType) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const payload = {
    member_id: memberId,
    authorization_type: authorizationType,
    detail: normText(row.detail),
    start_date: normText(row.startDate),
    end_date: normText(row.endDate),
    status: normAuthStatus(row.status),
    admin_notes: normText(row.adminNotes),
  };

  const recordId = normText(row.id);
  if (recordId) {
    const { error } = await admin
      .from("supervision_authorizations")
      .update(payload)
      .eq("id", recordId)
      .eq("member_id", memberId);
    if (error) return { ok: false, error: error.message };
    await audit(admin, caller.userId, "supervision_authorization_updated", recordId, {
      member_id: memberId,
      authorization_type: authorizationType,
    });
  } else {
    const { data, error } = await admin
      .from("supervision_authorizations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    await audit(admin, caller.userId, "supervision_authorization_created", data?.id ?? null, {
      member_id: memberId,
      authorization_type: authorizationType,
    });
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Delete a supervision authorization. ADMIN-GATED. Scoped by id AND member_id.
 */
export async function deleteAuthorization(
  memberId: string,
  id: string,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("supervision_authorizations")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  await audit(admin, caller.userId, "supervision_authorization_deleted", id, { member_id: memberId });

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/** Best-effort audit log write. Never throws into the caller's result. */
async function audit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  adminId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action,
      target_table: action.startsWith("supervision_authorization")
        ? "supervision_authorizations"
        : "supervision_records",
      target_id: targetId,
      details,
    });
  } catch {
    /* best-effort */
  }
}
