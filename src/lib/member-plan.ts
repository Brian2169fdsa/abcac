/**
 * MEMBER NEXT-STEPS PLAN — pure, side-effect-free derivation logic.
 *
 * Given plain snapshots of a member's state (profile completeness, account
 * status, certifications, CEU compliance, missing documents), produce an
 * ordered list of guided "next steps" toward certification / renewal.
 *
 * Keep this deterministic and free of I/O so it stays trivially unit-testable.
 * Callers in the dashboard fetch the real Supabase rows and map them into the
 * plain `MemberPlanInput` shape below.
 */

export type PlanStatus = "todo" | "in_progress" | "done";
export type PlanPriority = "high" | "medium" | "low";

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  /** ISO date string when this step has a hard deadline (renewals). */
  dueDate?: string;
  status: PlanStatus;
  href: string;
  priority: PlanPriority;
}

/** A single credential, reduced to the fields the plan cares about. */
export interface PlanCert {
  cert_type?: string | null;
  status?: string | null;
  /** ISO date (or schedule-derived next-due date). */
  expiration_date?: string | null;
}

/** The CEU compliance summary (subset of ComplianceResult from ceu-compliance). */
export interface PlanCeuCompliance {
  compliant: boolean;
  remaining: number;
  requiredTotal: number;
  totalApproved: number;
}

export interface MemberPlanInput {
  /** Profile completeness, 0–100. */
  profileCompleteness: number;
  /** Member application/account status, e.g. "none" | "submitted" | "approved". */
  accountStatus: AccountStatus;
  /** The member's certifications. */
  certifications: PlanCert[];
  /** CEU compliance result (only meaningful once an active cert exists). */
  ceuCompliance: PlanCeuCompliance;
  /** Count of documents ABCAC has requested but not yet received. */
  missingDocuments: number;
  /** "Today" — injectable for deterministic tests. */
  asOf?: Date;
  /** Renewal-warning window in days (default 90). */
  renewalWindowDays?: number;
}

export type AccountStatus =
  | "none"
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "active";

const PROFILE_THRESHOLD = 100;

function hasActiveCert(certs: PlanCert[]): boolean {
  return certs.some((c) => c.status === "active");
}

/** Earliest expiration date among active certs (ISO string), or null. */
function soonestExpiration(certs: PlanCert[]): string | null {
  const dates = certs
    .filter((c) => c.status === "active" && c.expiration_date)
    .map((c) => c.expiration_date as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return dates[0] ?? null;
}

function daysUntil(iso: string, asOf: Date): number {
  return Math.ceil((new Date(iso).getTime() - asOf.getTime()) / 86_400_000);
}

/**
 * Build the ordered list of next steps for a member.
 *
 * Order (and the natural progression toward certification / renewal):
 *   1. Complete your profile
 *   2. Submit your application / get approved
 *   3. Upload requested documents
 *   4. Earn your CEUs (shows the shortfall)
 *   5. Renew before your credential expires
 *
 * Steps that are already satisfied are returned with status `"done"` so the UI
 * can render a full checklist. Steps that don't apply at all (e.g. no active
 * cert yet → no renewal step) are omitted.
 */
export function buildMemberPlan(input: MemberPlanInput): PlanStep[] {
  const asOf = input.asOf ?? new Date();
  const renewalWindow = input.renewalWindowDays ?? 90;
  const active = hasActiveCert(input.certifications);
  const steps: PlanStep[] = [];

  // 1 ─ Complete your profile ────────────────────────────────────────────────
  const profileDone = input.profileCompleteness >= PROFILE_THRESHOLD;
  steps.push({
    id: "complete-profile",
    title: "Complete your profile",
    detail: profileDone
      ? "Your profile is complete."
      : `Your profile is ${Math.round(input.profileCompleteness)}% complete. A full profile helps ABCAC process your applications faster.`,
    status: profileDone
      ? "done"
      : input.profileCompleteness > 0
        ? "in_progress"
        : "todo",
    href: "/account/profile",
    priority: "high",
  });

  // 2 ─ Submit application / get approved ─────────────────────────────────────
  const appDone = active || input.accountStatus === "approved";
  const appInProgress =
    input.accountStatus === "submitted" ||
    input.accountStatus === "in_review" ||
    input.accountStatus === "draft";
  steps.push({
    id: "submit-application",
    title: active || input.accountStatus === "approved"
      ? "Application approved"
      : appInProgress
        ? "Application under review"
        : "Submit your certification application",
    detail: appDone
      ? "Your certification application has been approved."
      : appInProgress
        ? "Your application is being reviewed by ABCAC. We'll let you know when it's approved."
        : "Submit your initial certification application to get started.",
    status: appDone ? "done" : appInProgress ? "in_progress" : "todo",
    href: appDone ? "/account/applications" : "/account/apply",
    priority: "high",
  });

  // 3 ─ Upload requested documents ────────────────────────────────────────────
  const docsDone = input.missingDocuments <= 0;
  steps.push({
    id: "upload-documents",
    title: docsDone
      ? "Required documents submitted"
      : `Upload ${input.missingDocuments} requested document${input.missingDocuments !== 1 ? "s" : ""}`,
    detail: docsDone
      ? "All requested documents are on file."
      : `ABCAC has requested ${input.missingDocuments} document${input.missingDocuments !== 1 ? "s" : ""}. Upload ${input.missingDocuments !== 1 ? "them" : "it"} to keep your certification moving.`,
    status: docsDone ? "done" : "todo",
    href: "/account/documents",
    priority: docsDone ? "low" : "high",
  });

  // 4 ─ Earn your CEUs ────────────────────────────────────────────────────────
  // Only relevant once the member holds an active credential to renew.
  if (active) {
    const ceu = input.ceuCompliance;
    const ceuDone = ceu.compliant;
    steps.push({
      id: "earn-ceus",
      title: ceuDone
        ? "CEU requirement met"
        : `Earn ${ceu.remaining} more CEU hour${ceu.remaining !== 1 ? "s" : ""}`,
      detail: ceuDone
        ? `You've completed your ${ceu.requiredTotal} required CEU hours.`
        : `You have ${ceu.totalApproved} of ${ceu.requiredTotal} required CEU hours. Log ${ceu.remaining} more approved hour${ceu.remaining !== 1 ? "s" : ""} to stay compliant.`,
      status: ceuDone ? "done" : ceu.totalApproved > 0 ? "in_progress" : "todo",
      href: "/account/ceus",
      priority: ceuDone ? "low" : "medium",
    });
  }

  // 5 ─ Renew before expiration ───────────────────────────────────────────────
  const expiration = soonestExpiration(input.certifications);
  if (active && expiration) {
    const days = daysUntil(expiration, asOf);
    const overdue = days < 0;
    const dueSoon = days >= 0 && days <= renewalWindow;
    const detail = overdue
      ? "Your credential has lapsed. Renew now to restore your certification."
      : dueSoon
        ? `Your credential expires in ${days} day${days !== 1 ? "s" : ""}. Renew before it lapses.`
        : `Your credential is in good standing. Renew before it expires.`;
    steps.push({
      id: "renew-certification",
      title: overdue ? "Renew your lapsed credential" : "Renew your certification",
      detail,
      dueDate: expiration,
      // "done" doesn't apply to renewal — it's an ongoing obligation. Treat an
      // upcoming/overdue renewal as actionable, a far-off one as not-yet-started.
      status: overdue || dueSoon ? "in_progress" : "todo",
      href: "/account/renew",
      priority: overdue ? "high" : dueSoon ? "high" : "low",
    });
  }

  return steps;
}

/** True when every applicable step is done (used for the "all caught up" state). */
export function isPlanComplete(steps: PlanStep[]): boolean {
  return steps.length > 0 && steps.every((s) => s.status === "done");
}
