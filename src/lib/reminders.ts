// ABCAC — reminder engine (pure logic)
//
// Computes the set of reminders that are *currently due* for a single member
// from their certifications, CEU status, open document requests, and visible
// tasks. The logic is deterministic and side-effect free so it can be unit
// tested without a database. The cron route (and the manual "send reminder"
// action) feed in already-fetched data, then deliver + dedupe each reminder.
//
// Each reminder carries a stable `dedupeKey`. The caller inserts that key into
// `reminder_log` (UNIQUE) before sending, so a given reminder goes out at most
// once — re-runs are no-ops.

export type ReminderType =
  | "renewal_90"
  | "renewal_60"
  | "renewal_30"
  | "ceu_shortfall"
  | "doc_request"
  | "task_due";

export interface ReminderCertInput {
  id: string;
  certType: string | null;
  expiration: string | null;
  status: string | null;
  /** Whether this credential's CEU requirements are already met. */
  ceuMet?: boolean;
}

export interface ReminderDocRequestInput {
  id: string;
  documentType: string | null;
  createdAt: string | null;
}

export interface ReminderTaskInput {
  id: string;
  title: string;
  dueDate: string | null;
  status: string | null;
  visibleToMember: boolean;
}

export interface ReminderPrefs {
  renewalReminders: boolean;
  ceuDeadlineAlerts: boolean;
}

export interface ReminderContext {
  today: Date;
  firstName?: string | null;
  certs: ReminderCertInput[];
  openDocRequests: ReminderDocRequestInput[];
  tasks: ReminderTaskInput[];
  prefs: ReminderPrefs;
}

export interface Reminder {
  type: ReminderType;
  dedupeKey: string;
  subject: string;
  /** Plain-text body; the caller wraps it for email + an in-portal message. */
  body: string;
}

const MS_PER_DAY = 86_400_000;
/** Whole days from `today` until `date` (negative = in the past). */
export function daysUntil(today: Date, date: string | Date): number {
  const target = typeof date === "string" ? new Date(date) : date;
  return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Renewal tiers in ascending order; the smallest crossed tier is emitted. */
const RENEWAL_TIERS = [30, 60, 90] as const;
/** CEU alerts begin this many days before a credential expires. */
const CEU_WINDOW_DAYS = 60;
/** Open document requests older than this many days get a nudge. */
const DOC_REQUEST_AGE_DAYS = 7;
/** Tasks due within this many days (or overdue) get a reminder. */
const TASK_DUE_WINDOW_DAYS = 3;

function ym(today: Date): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}
function isoWeek(today: Date): string {
  // Coarse weekly bucket (epoch-week) — only needs to be stable within a week.
  return String(Math.floor(today.getTime() / (MS_PER_DAY * 7)));
}
function greet(name?: string | null): string {
  const n = (name ?? "").trim();
  return n ? `Hi ${n},` : "Hello,";
}

/**
 * Compute every reminder currently due for one member. Pure — no I/O. The
 * caller is responsible for delivery + dedupe via `reminder_log`.
 */
export function computeReminders(ctx: ReminderContext): Reminder[] {
  const out: Reminder[] = [];
  const hello = greet(ctx.firstName);

  // ── Renewal reminders: one per crossed 90/60/30 tier, most urgent only ──
  if (ctx.prefs.renewalReminders) {
    for (const cert of ctx.certs) {
      if (cert.status !== "active" || !cert.expiration) continue;
      const days = daysUntil(ctx.today, cert.expiration);
      const tier = RENEWAL_TIERS.find((t) => days <= t); // smallest crossed
      if (tier === undefined) continue; // more than 90 days out
      const label = cert.certType ?? "certification";
      const when = days < 0 ? "has expired" : days === 0 ? "expires today" : `expires in ${days} days`;
      out.push({
        type: `renewal_${tier}` as ReminderType,
        dedupeKey: `renewal:${cert.id}:${tier}`,
        subject: `Your ${label} ${days < 0 ? "has expired" : `renews in ${days} days`}`,
        body: `${hello}\n\nYour ${label} ${when}. Renew now in your ABCAC member portal to keep your credential active.`,
      });
    }
  }

  // ── CEU shortfall: behind on hours within 60 days of expiry ──
  if (ctx.prefs.ceuDeadlineAlerts) {
    for (const cert of ctx.certs) {
      if (cert.status !== "active" || !cert.expiration) continue;
      if (cert.ceuMet) continue;
      const days = daysUntil(ctx.today, cert.expiration);
      if (days < 0 || days > CEU_WINDOW_DAYS) continue;
      const label = cert.certType ?? "certification";
      out.push({
        type: "ceu_shortfall",
        // Monthly bucket so the nudge can repeat once a month while behind.
        dedupeKey: `ceu:${cert.id}:${ym(ctx.today)}`,
        subject: `Action needed: CEUs due before your ${label} renewal`,
        body: `${hello}\n\nYou still have outstanding continuing-education hours for your ${label}, which renews in ${days} days. Log your CEUs in the ABCAC portal so your renewal isn't delayed.`,
      });
    }
  }

  // ── Aging open document requests ──
  for (const req of ctx.openDocRequests) {
    if (!req.createdAt) continue;
    const age = -daysUntil(ctx.today, req.createdAt); // days since created
    if (age < DOC_REQUEST_AGE_DAYS) continue;
    const what = req.documentType ?? "a document";
    out.push({
      type: "doc_request",
      // Weekly bucket so it nudges at most once a week until fulfilled.
      dedupeKey: `docreq:${req.id}:${isoWeek(ctx.today)}`,
      subject: `Reminder: ABCAC is waiting on ${what}`,
      body: `${hello}\n\nABCAC requested ${what} ${age} days ago and it's still outstanding. Please upload it in your member portal so we can keep your file moving.`,
    });
  }

  // ── Tasks due soon or overdue (member-visible only) ──
  for (const task of ctx.tasks) {
    if (!task.visibleToMember) continue;
    if (task.status === "done" || task.status === "cancelled") continue;
    if (!task.dueDate) continue;
    const days = daysUntil(ctx.today, task.dueDate);
    if (days > TASK_DUE_WINDOW_DAYS) continue;
    const when = days < 0 ? `was due ${-days} days ago` : days === 0 ? "is due today" : `is due in ${days} days`;
    out.push({
      type: "task_due",
      dedupeKey: `task:${task.id}:${task.dueDate}`,
      subject: `Reminder: "${task.title}" ${days < 0 ? "is overdue" : "is due soon"}`,
      body: `${hello}\n\nYour ABCAC to-do "${task.title}" ${when}. You can take care of it in your member portal.`,
    });
  }

  return out;
}
