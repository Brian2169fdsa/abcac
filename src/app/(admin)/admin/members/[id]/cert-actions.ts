"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Certification lifecycle actions for the member-detail page. Closes parity gap
// B5: admins can ISSUE a cert (issue-cert-form) but previously could not
// revoke/expire/edit/toggle-sync an existing one.
//
// Mirrors cockpit-actions.ts: every action RE-CHECKS the caller's portal_role
// server-side on the cookie-bound session (the client never carries trusted
// authorization), writes through the service-role admin client, scopes every
// write by BOTH id AND member_id, writes an admin_audit_log entry, and
// revalidates the member page. `certifications` is member-read-only
// (migration 013) but the admin RLS policy permits these admin writes.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

const VALID_STATUSES = ["active", "expired", "revoked"] as const;
type CertStatus = (typeof VALID_STATUSES)[number];

/** Editable scalar fields on a certification (lifecycle edit, not re-issue). */
export type CertEditableFields = {
  cert_number?: string | null;
  issued_date?: string | null;
  expiration_date?: string | null;
  ic_rc_level?: string | null;
};

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

/** Normalize an editable string field: trim, and treat empty as null. */
function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Edit the lifecycle fields of an existing certification. ADMIN-GATED. Scoped
 * by id AND member_id so an admin cannot accidentally edit another member's
 * cert by passing a mismatched pair. Only cert_number, issued_date,
 * expiration_date, and ic_rc_level are editable here — re-issuing a cert
 * (cert_type / file upload) lives in issue-cert-form.
 */
export async function updateCertification(
  memberId: string,
  id: string,
  fields: CertEditableFields,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  // Build the patch from only the provided keys, so a partial edit leaves
  // untouched columns alone.
  const patch: Record<string, string | null> = {};
  if ("cert_number" in fields) patch.cert_number = norm(fields.cert_number);
  if ("issued_date" in fields) patch.issued_date = norm(fields.issued_date);
  if ("expiration_date" in fields) patch.expiration_date = norm(fields.expiration_date);
  if ("ic_rc_level" in fields) patch.ic_rc_level = norm(fields.ic_rc_level);
  if (Object.keys(patch).length === 0) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certifications")
    .update(patch)
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "certification_updated",
      target_table: "certifications",
      target_id: id,
      details: { member_id: memberId, fields: patch },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Set a certification's status to active | expired | revoked. ADMIN-GATED.
 * Scoped by id AND member_id and audited (old/new transition is recorded via
 * the new status; the page revalidates to reflect the change).
 */
export async function setCertStatus(
  memberId: string,
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };
  if (!VALID_STATUSES.includes(status as CertStatus)) {
    return { ok: false, error: "bad_request" };
  }

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certifications")
    .update({ status })
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "certification_status_changed",
      target_table: "certifications",
      target_id: id,
      details: { member_id: memberId, status },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Toggle a certification's sync_enabled flag. ADMIN-GATED, scoped by id AND
 * member_id, audited, revalidated.
 */
export async function toggleCertSync(
  memberId: string,
  id: string,
  enabled: boolean,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("certifications")
    .update({ sync_enabled: enabled })
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "certification_sync_toggled",
      target_table: "certifications",
      target_id: id,
      details: { member_id: memberId, sync_enabled: enabled },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}
