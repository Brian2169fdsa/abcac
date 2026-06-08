"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { runRemindersForMembers } from "@/lib/reminders-runner";

// Manual "run reminders now" for a single member. ADMIN-GATED. Runs the same
// engine the daily cron uses, scoped to one member, so it only delivers what is
// actually due and is deduped via reminder_log (clicking twice won't re-send).

type ReminderActionResult =
  | { ok: true; remindersSent: number; emailsSent: number }
  | { ok: false; error: string };

export async function runMemberReminders(memberId: string): Promise<ReminderActionResult> {
  if (!memberId) return { ok: false, error: "bad_request" };

  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb.from("profiles").select("portal_role").eq("id", user.id).maybeSingle();
  if (!isAdminRole(profile?.portal_role)) return { ok: false, error: "forbidden" };

  try {
    const admin = createSupabaseAdminClient();
    const summary = await runRemindersForMembers(admin, [memberId], user.id);

    try {
      await admin.from("admin_audit_log").insert({
        admin_id: user.id,
        action: "reminders_run",
        target_table: "reminder_log",
        target_id: null,
        details: { member_id: memberId, reminders_sent: summary.remindersSent, emails_sent: summary.emailsSent },
      });
    } catch {
      /* best-effort */
    }

    revalidatePath(`/admin/members/${memberId}`);
    return { ok: true, remindersSent: summary.remindersSent, emailsSent: summary.emailsSent };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "reminder_run_failed" };
  }
}
