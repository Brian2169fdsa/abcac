"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Admin override for a member's notification_preferences. Mirrors the cockpit
// security pattern exactly: the caller's portal_role is RE-CHECKED server-side
// on the cookie-bound session, the privileged write runs through the service
// role admin client, and every change is written to admin_audit_log and
// revalidated. The reminders engine reads renewal_reminders / ceu_deadline_alerts
// from this table, so an admin override here directly gates automated reminders.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

/** The four boolean toggles an admin may override. */
export type NotificationPrefsInput = {
  renewal_reminders: boolean;
  ceu_deadline_alerts: boolean;
  abcac_announcements: boolean;
  icrc_updates: boolean;
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

/**
 * Override a member's notification preferences. ADMIN-GATED. UPSERTs the four
 * boolean toggles (plus a fresh updated_at) into `notification_preferences`,
 * keyed on the UNIQUE member_id, then audits and revalidates the member page.
 * The renewal_reminders / ceu_deadline_alerts flags gate the scheduled reminders
 * engine, so this is how staff suppress or re-enable automated reminders.
 */
export async function setMemberNotificationPrefs(
  memberId: string,
  prefs: NotificationPrefsInput,
): Promise<ActionResult> {
  if (!memberId || !prefs) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  // Normalize to strict booleans so a missing/undefined toggle never writes NULL.
  const row = {
    member_id: memberId,
    renewal_reminders: Boolean(prefs.renewal_reminders),
    ceu_deadline_alerts: Boolean(prefs.ceu_deadline_alerts),
    abcac_announcements: Boolean(prefs.abcac_announcements),
    icrc_updates: Boolean(prefs.icrc_updates),
    updated_at: new Date().toISOString(),
  };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("notification_preferences")
    .upsert(row, { onConflict: "member_id" });
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "notification_prefs_overridden",
      target_table: "notification_preferences",
      target_id: null,
      details: {
        member_id: memberId,
        renewal_reminders: row.renewal_reminders,
        ceu_deadline_alerts: row.ceu_deadline_alerts,
        abcac_announcements: row.abcac_announcements,
        icrc_updates: row.icrc_updates,
      },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}
