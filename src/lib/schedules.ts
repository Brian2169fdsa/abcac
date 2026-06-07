/**
 * CERT DUE-DATES ENGINE — pure TS helpers (no DB calls).
 *
 * Given a cert_schedules reference row (the renewal rules for a credential)
 * plus a member's known date (their certification.expiration_date, or the date
 * of their last renewal), compute:
 *   • next_due_date  — when the credential is next due to renew
 *   • days_until_due — whole days from "today" to that due date (negative = past)
 *   • tier           — a coarse reminder bucket (90 / 60 / 30 / 7 / overdue / ok)
 *
 * Supabase stays the single source of truth: these helpers only transform REAL
 * db state into computed values. They are intentionally side-effect-free so
 * they compile under the Next typecheck and are unit-testable.
 */

/** Shape of a public.cert_schedules row (see migration 016). */
export interface CertSchedule {
  credential_type: string;
  renewal_cycle_months: number;
  ceu_total_required: number;
  ceu_ethics_required: number;
  ceu_cultural_required: number;
  grace_period_days: number;
  notes?: string | null;
}

/**
 * Pick the cert_schedules row matching a member's credential type from a list
 * of schedules. Case-insensitive, trims whitespace. Returns undefined when no
 * row matches (caller should then fall back to default behavior).
 *
 * Pure: callers fetch the rows from Supabase and pass them in.
 */
export function findScheduleFor(
  schedules: CertSchedule[],
  credentialType: string | null | undefined,
): CertSchedule | undefined {
  if (!credentialType) return undefined;
  const key = credentialType.trim().toLowerCase();
  return schedules.find((s) => s.credential_type?.trim().toLowerCase() === key);
}

/** Reminder tiers, ordered most-distant → past. */
export type DueTier = "90-day" | "60-day" | "30-day" | "7-day" | "due" | "overdue" | "ok";

/** The reminder-threshold days, descending. Mirrors scheduled-reminders. */
export const REMINDER_TIER_DAYS = [90, 60, 30, 7] as const;

export interface DueDateResult {
  /** The credential's next renewal due date (ISO yyyy-mm-dd). */
  nextDueDate: string;
  /** Whole days from `asOf` to nextDueDate. Negative when already past. */
  daysUntilDue: number;
  /** Coarse reminder bucket for this credential. */
  tier: DueTier;
  /** nextDueDate + grace_period_days; after this the credential has lapsed. */
  graceEndDate: string;
  /** True when today is past nextDueDate but still within the grace window. */
  inGracePeriod: boolean;
  /** True when today is past the grace window (credential lapsed). */
  lapsed: boolean;
}

/** Parse a yyyy-mm-dd (or ISO) string into a UTC-midnight Date. */
function parseDate(value: string | Date): Date {
  if (value instanceof Date) return atUtcMidnight(value);
  // Accept "2026-06-07" and full ISO timestamps alike.
  const d = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return atUtcMidnight(d);
}

function atUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Format a Date as yyyy-mm-dd (UTC). */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add whole months to a date, clamping day-of-month for short months. */
export function addMonths(value: string | Date, months: number): string {
  const d = parseDate(value);
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1));
  // Clamp the day so e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3.
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toIsoDate(result);
}

/** Add whole days to a date, returning yyyy-mm-dd. */
export function addDays(value: string | Date, days: number): string {
  const d = parseDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Whole-day difference (to - from); positive when `to` is in the future. */
export function daysBetween(from: string | Date, to: string | Date): number {
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Map a days-until-due value to a reminder tier. */
export function tierForDays(daysUntilDue: number): DueTier {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due";
  if (daysUntilDue <= 7) return "7-day";
  if (daysUntilDue <= 30) return "30-day";
  if (daysUntilDue <= 60) return "60-day";
  if (daysUntilDue <= 90) return "90-day";
  return "ok";
}

/**
 * True when `daysUntilDue` lands exactly on one of the reminder thresholds
 * (used by senders that fire only on the exact threshold day).
 */
export function isExactReminderDay(daysUntilDue: number): boolean {
  return (REMINDER_TIER_DAYS as readonly number[]).includes(daysUntilDue);
}

/**
 * Compute due-date info treating `expirationDate` as the next renewal date.
 * Use this when the member already has a known certification.expiration_date.
 */
export function computeDueFromExpiration(
  schedule: Pick<CertSchedule, "grace_period_days">,
  expirationDate: string | Date,
  asOf: string | Date = new Date(),
): DueDateResult {
  const nextDueDate = toIsoDate(parseDate(expirationDate));
  return assemble(schedule, nextDueDate, asOf);
}

/**
 * Compute due-date info from the date of the member's LAST renewal (or initial
 * issue), projecting forward by the credential's renewal_cycle_months.
 * Use this when there is no stored expiration_date.
 */
export function computeDueFromLastRenewal(
  schedule: Pick<CertSchedule, "renewal_cycle_months" | "grace_period_days">,
  lastRenewalDate: string | Date,
  asOf: string | Date = new Date(),
): DueDateResult {
  const nextDueDate = addMonths(lastRenewalDate, schedule.renewal_cycle_months);
  return assemble(schedule, nextDueDate, asOf);
}

function assemble(
  schedule: Pick<CertSchedule, "grace_period_days">,
  nextDueDate: string,
  asOf: string | Date,
): DueDateResult {
  const daysUntilDue = daysBetween(asOf, nextDueDate);
  const graceEndDate = addDays(nextDueDate, schedule.grace_period_days ?? 0);
  const daysUntilGraceEnd = daysBetween(asOf, graceEndDate);
  return {
    nextDueDate,
    daysUntilDue,
    tier: tierForDays(daysUntilDue),
    graceEndDate,
    inGracePeriod: daysUntilDue < 0 && daysUntilGraceEnd >= 0,
    lapsed: daysUntilGraceEnd < 0,
  };
}
