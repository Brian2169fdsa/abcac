"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Admin management of a member's employment history and "other certifications".
// Closes parity gap B3 (the admin view was previously read-only). Each action
// RE-CHECKS the caller's portal_role server-side on the cookie-bound session —
// the client never carries authorization. Writes run through the service-role
// admin client, are audited to `admin_audit_log`, and revalidate the member page.

type ActionResult = { ok: true; id: string } | { ok: false; error: string };
type DeleteResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
/** Normalize a date-ish value to an ISO `YYYY-MM-DD` string or null. */
function dateOrNull(v: unknown): string | null {
  const s = str(v);
  return s ? s : null;
}

// ---------------------------------------------------------------------------
// employment_records
// ---------------------------------------------------------------------------

export interface EmploymentInput {
  id?: string | null;
  employer_name: string;
  position_title: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
}

/**
 * Create or update one employment_records row for a member. ADMIN-GATED.
 * Inserts force `member_id = memberId`; updates are scoped by BOTH `id` and
 * `member_id` so an admin can never mutate another member's row by id alone.
 */
export async function upsertEmployment(
  memberId: string,
  row: EmploymentInput,
): Promise<ActionResult> {
  if (!memberId) return { ok: false, error: "bad_request" };
  const employer_name = str(row?.employer_name);
  const position_title = str(row?.position_title);
  if (!employer_name || !position_title) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const fields = {
    employer_name,
    position_title,
    start_date: dateOrNull(row?.start_date),
    end_date: dateOrNull(row?.end_date),
    is_current: !!row?.is_current,
  };
  const id = str(row?.id);

  if (id) {
    const { data, error } = await admin
      .from("employment_records")
      .update(fields)
      .eq("id", id)
      .eq("member_id", memberId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "not_found" };
    await audit(admin, caller.userId, "employment_updated", "employment_records", data.id, {
      member_id: memberId,
      ...fields,
    });
    revalidatePath(MEMBER_PAGE(memberId));
    return { ok: true, id: data.id };
  }

  const { data, error } = await admin
    .from("employment_records")
    .insert({ member_id: memberId, ...fields })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await audit(admin, caller.userId, "employment_created", "employment_records", data.id, {
    member_id: memberId,
    ...fields,
  });
  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true, id: data.id };
}

/** Delete one employment_records row, scoped by id AND member_id. ADMIN-GATED. */
export async function deleteEmployment(
  memberId: string,
  id: string,
): Promise<DeleteResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("employment_records")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  await audit(admin, caller.userId, "employment_deleted", "employment_records", id, {
    member_id: memberId,
  });
  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// other_certifications
// ---------------------------------------------------------------------------

export interface OtherCertInput {
  id?: string | null;
  credential_title: string;
  credential_number?: string | null;
  issuing_board: string;
  issued_date?: string | null;
  expiration_date?: string | null;
}

/**
 * Create or update one other_certifications row for a member. ADMIN-GATED.
 * Inserts force `member_id = memberId`; updates scope by BOTH `id` and `member_id`.
 */
export async function upsertOtherCert(
  memberId: string,
  row: OtherCertInput,
): Promise<ActionResult> {
  if (!memberId) return { ok: false, error: "bad_request" };
  const credential_title = str(row?.credential_title);
  const issuing_board = str(row?.issuing_board);
  if (!credential_title || !issuing_board) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const fields = {
    credential_title,
    credential_number: str(row?.credential_number) || null,
    issuing_board,
    issued_date: dateOrNull(row?.issued_date),
    expiration_date: dateOrNull(row?.expiration_date),
  };
  const id = str(row?.id);

  if (id) {
    const { data, error } = await admin
      .from("other_certifications")
      .update(fields)
      .eq("id", id)
      .eq("member_id", memberId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "not_found" };
    await audit(admin, caller.userId, "other_cert_updated", "other_certifications", data.id, {
      member_id: memberId,
      ...fields,
    });
    revalidatePath(MEMBER_PAGE(memberId));
    return { ok: true, id: data.id };
  }

  const { data, error } = await admin
    .from("other_certifications")
    .insert({ member_id: memberId, ...fields })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await audit(admin, caller.userId, "other_cert_created", "other_certifications", data.id, {
    member_id: memberId,
    ...fields,
  });
  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true, id: data.id };
}

/** Delete one other_certifications row, scoped by id AND member_id. ADMIN-GATED. */
export async function deleteOtherCert(
  memberId: string,
  id: string,
): Promise<DeleteResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("other_certifications")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  await audit(admin, caller.userId, "other_cert_deleted", "other_certifications", id, {
    member_id: memberId,
  });
  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

// ---------------------------------------------------------------------------

/** Best-effort audit write — never blocks the primary mutation. */
async function audit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  adminId: string,
  action: string,
  targetTable: string,
  targetId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action,
      target_table: targetTable,
      target_id: targetId,
      details,
    });
  } catch {
    /* best-effort */
  }
}
