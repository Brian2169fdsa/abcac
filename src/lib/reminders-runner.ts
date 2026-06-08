// ABCAC — reminder runner (server-side delivery + dedupe)
//
// Wraps the pure `computeReminders` engine with data loading and delivery.
// Used by the daily Vercel-cron route and by the admin "send reminder now"
// action. Every reminder is recorded in `reminder_log` (UNIQUE dedupe_key)
// BEFORE it is sent, so a reminder is delivered at most once. Email is sent via
// Resend (a no-op without RESEND_API_KEY) and an in-portal message is always
// written, so reminders work in-platform even before email is configured.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { computeReminders, type ReminderContext, type ReminderCertInput } from "@/lib/reminders";
import { computeCompliance, requirementsFromSchedule, type CeuLike } from "@/lib/ceu-compliance";
import { findScheduleFor, type CertSchedule } from "@/lib/schedules";

export interface ReminderRunSummary {
  membersProcessed: number;
  remindersSent: number;
  emailsSent: number;
}

function htmlFromText(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 12px">${line}</p>`))
    .join("");
}

/** Collect every member who might be due for a reminder (cron entry point). */
async function collectMemberIds(admin: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const [{ data: certs }, { data: reqs }, { data: tasks }] = await Promise.all([
    admin.from("certifications").select("member_id").eq("status", "active").not("expiration_date", "is", null),
    admin.from("document_requests").select("member_id").eq("status", "open"),
    admin.from("member_tasks").select("member_id").eq("visible_to_member", true).not("status", "in", '("done","cancelled")'),
  ]);
  for (const r of (certs as { member_id: string }[] | null) ?? []) ids.add(r.member_id);
  for (const r of (reqs as { member_id: string }[] | null) ?? []) ids.add(r.member_id);
  for (const r of (tasks as { member_id: string }[] | null) ?? []) ids.add(r.member_id);
  return Array.from(ids);
}

/** Build the reminder context for one member from the DB. */
async function loadContext(
  admin: SupabaseClient,
  memberId: string,
  schedules: CertSchedule[],
  today: Date,
): Promise<ReminderContext | null> {
  const [{ data: profile }, { data: prefs }, { data: certs }, { data: ceus }, { data: docReqs }, { data: tasks }] =
    await Promise.all([
      admin.from("profiles").select("email, first_name").eq("id", memberId).maybeSingle(),
      admin.from("notification_preferences").select("renewal_reminders, ceu_deadline_alerts").eq("member_id", memberId).maybeSingle(),
      admin.from("certifications").select("id, cert_type, expiration_date, status").eq("member_id", memberId),
      admin.from("ceu_records").select("hours, category, status").eq("member_id", memberId),
      admin.from("document_requests").select("id, document_type, created_at").eq("member_id", memberId).eq("status", "open"),
      admin.from("member_tasks").select("id, title, due_date, status, visible_to_member").eq("member_id", memberId).eq("visible_to_member", true),
    ]);

  if (!profile) return null;

  const certRows = (certs as { id: string; cert_type: string | null; expiration_date: string | null; status: string | null }[] | null) ?? [];
  // CEU pool is member-wide; gauge it against the soonest-expiring active cert's schedule.
  const active = certRows.filter((c) => c.status === "active" && c.expiration_date);
  const primary = active.slice().sort((a, b) =>
    new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime(),
  )[0];
  const requirements = requirementsFromSchedule(findScheduleFor(schedules, primary?.cert_type));
  const compliance = computeCompliance((ceus as CeuLike[] | null) ?? [], requirements);

  const certInputs: ReminderCertInput[] = certRows.map((c) => ({
    id: c.id,
    certType: c.cert_type,
    expiration: c.expiration_date,
    status: c.status,
    ceuMet: compliance.compliant,
  }));

  return {
    today,
    firstName: (profile as { first_name: string | null }).first_name,
    certs: certInputs,
    openDocRequests: ((docReqs as { id: string; document_type: string | null; created_at: string | null }[] | null) ?? []).map((r) => ({
      id: r.id,
      documentType: r.document_type,
      createdAt: r.created_at,
    })),
    tasks: ((tasks as { id: string; title: string; due_date: string | null; status: string | null; visible_to_member: boolean }[] | null) ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      status: t.status,
      visibleToMember: t.visible_to_member,
    })),
    prefs: {
      renewalReminders: (prefs as { renewal_reminders: boolean | null } | null)?.renewal_reminders !== false,
      ceuDeadlineAlerts: (prefs as { ceu_deadline_alerts: boolean | null } | null)?.ceu_deadline_alerts !== false,
    },
  };
}

/** Deliver all currently-due reminders for the given members. */
export async function runRemindersForMembers(
  admin: SupabaseClient,
  memberIds: string[],
  sentBy: string | null = null,
): Promise<ReminderRunSummary> {
  const today = new Date();
  const { data: scheds } = await admin
    .from("cert_schedules")
    .select("credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes");
  const schedules = (scheds as CertSchedule[] | null) ?? [];

  let remindersSent = 0;
  let emailsSent = 0;

  for (const memberId of memberIds) {
    const ctx = await loadContext(admin, memberId, schedules, today);
    if (!ctx) continue;
    const email = (await admin.from("profiles").select("email").eq("id", memberId).maybeSingle()).data?.email as string | undefined;

    for (const reminder of computeReminders(ctx)) {
      // Claim the reminder first — UNIQUE dedupe_key makes this idempotent.
      const { error: claimErr } = await admin.from("reminder_log").insert({
        member_id: memberId,
        reminder_type: reminder.type,
        dedupe_key: reminder.dedupeKey,
        channel: "both",
        sent_by: sentBy,
        detail: { subject: reminder.subject },
      });
      if (claimErr) continue; // 23505 (already sent) or any error → skip delivery

      // In-portal message (always) — reminders work even before email is set up.
      await admin.from("messages").insert({
        member_id: memberId,
        from_name: "ABCAC",
        subject: reminder.subject,
        body: reminder.body,
        is_read: false,
      });

      // Email (best-effort; no-op without RESEND_API_KEY).
      if (email) {
        const ok = await sendEmail({ to: email, subject: reminder.subject, html: htmlFromText(reminder.body) });
        if (ok) emailsSent += 1;
      }
      remindersSent += 1;
    }
  }

  return { membersProcessed: memberIds.length, remindersSent, emailsSent };
}

/** Cron entry point: run reminders for every member who might be due. */
export async function runRemindersForAll(admin: SupabaseClient): Promise<ReminderRunSummary> {
  const memberIds = await collectMemberIds(admin);
  return runRemindersForMembers(admin, memberIds, null);
}
