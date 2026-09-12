// ABCAC — Certification Sync: real date math.
//
// Per the official "Certification Synchronization Request" form: the member
// lists the ABCAC certifications they hold, and every certification that
// expires earlier than the latest-expiring one moves forward to match it.
// The fee is $15 for each month any credential moves forward, summed across
// every credential being synced (not a single flat months figure).
//
// These are pure functions — no I/O — so the plan is computed identically
// whether it is previewed in the browser or built authoritatively on the
// server, and is easy to unit test.

export const SYNC_FEE_CENTS_PER_MONTH = 1500;

export interface SyncEligibleCertification {
  id: string;
  cert_type: string | null;
  cert_number: string | null;
  expiration_date: string | null; // ISO date (YYYY-MM-DD)
  status: string | null;
}

export interface CertSyncPlanItem {
  id: string;
  certType: string | null;
  certNumber: string | null;
  oldExpiration: string;
  monthsForward: number;
}

export interface CertSyncPlan {
  targetExpiration: string;
  items: CertSyncPlanItem[];
  totalMonths: number;
  totalFeeCents: number;
}

export type CertSyncPlanResult = { ok: true; plan: CertSyncPlan } | { ok: false; error: string };

/**
 * Whole calendar months between two ISO dates (`to` assumed >= `from`).
 * Day-of-month aware: Jan 31 -> Feb 28 is 0 whole months, Jan 31 -> Mar 1 is 1.
 */
export function monthsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Builds the synchronization plan for a set of the member's own certifications.
 * Requires at least two eligible (active, dated) certifications, matching the
 * official form's requirement. The target date is the latest expiration among
 * the selected certifications; every earlier one moves forward to meet it.
 */
export function buildCertSyncPlan(certs: SyncEligibleCertification[]): CertSyncPlanResult {
  const eligible = certs.filter((c) => c.status === "active" && !!c.expiration_date);
  if (eligible.length < 2) {
    return { ok: false, error: "Select at least two active certifications with expiration dates to synchronize." };
  }
  const targetExpiration = eligible.reduce(
    (latest, c) => (c.expiration_date! > latest ? c.expiration_date! : latest),
    eligible[0].expiration_date!,
  );
  const items: CertSyncPlanItem[] = eligible.map((c) => ({
    id: c.id,
    certType: c.cert_type,
    certNumber: c.cert_number,
    oldExpiration: c.expiration_date!,
    monthsForward: monthsBetween(c.expiration_date!, targetExpiration),
  }));
  const totalMonths = items.reduce((sum, item) => sum + item.monthsForward, 0);
  if (totalMonths <= 0) {
    return { ok: false, error: "These certifications already share the same expiration date." };
  }
  return { ok: true, plan: { targetExpiration, items, totalMonths, totalFeeCents: totalMonths * SYNC_FEE_CENTS_PER_MONTH } };
}
