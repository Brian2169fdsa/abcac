"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Member-detail "edit personal info" action. Closes parity gap B2: admins can
// view a member's profile but could not edit the contact fields. Mirrors the
// security pattern in cockpit-actions.ts — the caller's portal_role is RE-READ
// server-side on the cookie-bound session and gated with `isAdminRole`; the
// client never carries authorization. The write goes through the service-role
// admin client (admins bypass the profile guard trigger, so it succeeds), and
// every edit is audited.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

/** Contact columns an admin may edit. NEVER includes role/status/email. */
export type ProfileFields = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  ssn_last4?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

const EDITABLE_COLUMNS = [
  "first_name",
  "middle_name",
  "last_name",
  "phone",
  "date_of_birth",
  "ssn_last4",
  "address_line1",
  "city",
  "state",
  "zip_code",
] as const;

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
 * Normalize an incoming patch to ONLY the editable contact columns. Any other
 * key (e.g. portal_role, account_status, email) is dropped. Empty strings are
 * coerced to null so a cleared field is stored as null, not "".
 */
function sanitize(fields: ProfileFields): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const col of EDITABLE_COLUMNS) {
    if (!(col in fields)) continue;
    const raw = fields[col];
    if (raw === undefined) continue;
    const value = typeof raw === "string" ? raw.trim() : raw;
    patch[col] = value ? value : null;
  }
  return patch;
}

/**
 * Update a member's personal/contact info. ADMIN-GATED. Updates ONLY the
 * whitelisted contact columns on `profiles` (never portal_role/account_status/
 * email). Writes via the service-role admin client, audits the edit, and
 * revalidates the member page.
 */
export async function updateMemberProfile(
  memberId: string,
  fields: ProfileFields,
): Promise<ActionResult> {
  if (!memberId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const patch = sanitize(fields ?? {});
  if (Object.keys(patch).length === 0) return { ok: false, error: "no_fields" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "profile_updated",
      target_table: "profiles",
      target_id: memberId,
      details: { member_id: memberId, fields: Object.keys(patch) },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}
