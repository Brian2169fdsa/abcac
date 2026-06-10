// ABCAC — DEMO MOCK DATA for the AI Agent workspace + member analytics.
//
// This is *presentation* mock data, isolated from the real Supabase domain, so
// the admin AI-Agent tab and member dashboards look fully populated when the
// platform is shown off — without seeding the live database. Everything here is
// deterministic (no Math.random) so the demo renders identically every time.
//
// Domain: ABCAC addiction-counselor certification (credentials: LISAC, LASAC,
// LAC, LSAT, CADC, recertifications, CEUs, and merch/print fulfillment).

export type Trend = "up" | "down" | "flat";

export interface Kpi {
  /** Short label, e.g. "Certs sold (YTD)". */
  label: string;
  /** Display value, pre-formatted (e.g. "318", "$214.6K"). */
  value: string;
  /** Sub caption under the value. */
  sub: string;
  /** Optional delta string, e.g. "+12% MoM". */
  delta?: string;
  trend?: Trend;
}

export interface Datum {
  label: string;
  value: number;
  /** Optional secondary caption shown in legends/tooltips. */
  note?: string;
}

export interface SeriesPoint {
  label: string; // x label, e.g. "Jan"
  value: number;
}

export type CredentialType = "LISAC" | "LASAC" | "LAC" | "LSAT" | "CADC" | "Reciprocity";
export type MemberStatus = "active" | "pending" | "renewal_due" | "lapsed";

export interface MockMember {
  id: string;
  name: string;
  credential: CredentialType;
  status: MemberStatus;
  city: string;
  /** CEU hours completed toward the requirement. */
  ceuDone: number;
  ceuRequired: number;
  /** ISO date of next renewal. */
  renewal: string;
  /** Lifetime spend in dollars. */
  spend: number;
}

export type TaskKind =
  | "recertification"
  | "application"
  | "ceu_review"
  | "merch"
  | "approval"
  | "verification";

export type TaskPriority = "high" | "medium" | "low";

export interface MockTask {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  member: string;
  priority: TaskPriority;
  /** Human due string, e.g. "Due in 2 days". */
  due: string;
  /** Primary action button label. */
  action: string;
  /** Secondary action label (optional). */
  secondary?: string;
  /** Whether the agent can do this automatically (shows an "Automate" affordance). */
  automatable: boolean;
}

// ── KPIs (admin AI Agent dashboard header) ──────────────────────────────────

export const ADMIN_KPIS: Kpi[] = [
  { label: "Certs sold (YTD)", value: "318", sub: "Across 6 credential types", delta: "+12% vs last yr", trend: "up" },
  { label: "Active members", value: "1,247", sub: "892 in good standing", delta: "+38 this month", trend: "up" },
  { label: "Revenue (MTD)", value: "$214.6K", sub: "Certs · renewals · CEUs", delta: "+9% MoM", trend: "up" },
  { label: "Open tasks", value: "23", sub: "7 high priority", delta: "5 automatable", trend: "flat" },
];

// ── Certifications sold, by month (12 mo) ───────────────────────────────────

export const CERTS_BY_MONTH: SeriesPoint[] = [
  { label: "Jul", value: 18 },
  { label: "Aug", value: 22 },
  { label: "Sep", value: 27 },
  { label: "Oct", value: 24 },
  { label: "Nov", value: 31 },
  { label: "Dec", value: 19 },
  { label: "Jan", value: 34 },
  { label: "Feb", value: 29 },
  { label: "Mar", value: 41 },
  { label: "Apr", value: 38 },
  { label: "May", value: 44 },
  { label: "Jun", value: 36 },
];

// ── Credential mix (bar/donut) ──────────────────────────────────────────────

export const CERTS_BY_TYPE: Datum[] = [
  { label: "LISAC", value: 96, note: "Independent Substance Abuse Counselor" },
  { label: "LASAC", value: 74, note: "Associate Substance Abuse Counselor" },
  { label: "LAC", value: 58, note: "Licensed Associate Counselor" },
  { label: "CADC", value: 41, note: "Certified Alcohol & Drug Counselor" },
  { label: "LSAT", value: 28, note: "Substance Abuse Technician" },
  { label: "Reciprocity", value: 21, note: "Out-of-state transfers" },
];

// ── Revenue by stream (MTD, $) ──────────────────────────────────────────────

export const REVENUE_BY_STREAM: Datum[] = [
  { label: "New certs", value: 86400 },
  { label: "Renewals", value: 71200 },
  { label: "CEU fees", value: 28900 },
  { label: "Reciprocity", value: 16500 },
  { label: "Merch", value: 7300 },
  { label: "Verification", value: 4300 },
];

// ── Revenue trend (12 mo, $) ────────────────────────────────────────────────

export const REVENUE_BY_MONTH: SeriesPoint[] = [
  { label: "Jul", value: 142000 },
  { label: "Aug", value: 158000 },
  { label: "Sep", value: 171000 },
  { label: "Oct", value: 165000 },
  { label: "Nov", value: 189000 },
  { label: "Dec", value: 134000 },
  { label: "Jan", value: 196000 },
  { label: "Feb", value: 178000 },
  { label: "Mar", value: 221000 },
  { label: "Apr", value: 208000 },
  { label: "May", value: 234000 },
  { label: "Jun", value: 214600 },
];

// ── Members / customers ─────────────────────────────────────────────────────

export const MOCK_MEMBERS: MockMember[] = [
  { id: "m-1001", name: "Maria Gonzalez", credential: "LISAC", status: "active", city: "Phoenix", ceuDone: 40, ceuRequired: 40, renewal: "2027-03-14", spend: 1240 },
  { id: "m-1002", name: "James Whitfield", credential: "LASAC", status: "renewal_due", city: "Tucson", ceuDone: 31, ceuRequired: 40, renewal: "2026-07-02", spend: 880 },
  { id: "m-1003", name: "Aisha Bello", credential: "LAC", status: "active", city: "Mesa", ceuDone: 38, ceuRequired: 40, renewal: "2026-11-21", spend: 1015 },
  { id: "m-1004", name: "Derek Tran", credential: "CADC", status: "pending", city: "Chandler", ceuDone: 0, ceuRequired: 40, renewal: "2026-09-30", spend: 350 },
  { id: "m-1005", name: "Sofia Petrova", credential: "LISAC", status: "active", city: "Scottsdale", ceuDone: 40, ceuRequired: 40, renewal: "2027-01-08", spend: 1620 },
  { id: "m-1006", name: "Marcus Hale", credential: "LSAT", status: "renewal_due", city: "Glendale", ceuDone: 27, ceuRequired: 30, renewal: "2026-06-25", spend: 540 },
  { id: "m-1007", name: "Priya Nair", credential: "Reciprocity", status: "pending", city: "Tempe", ceuDone: 40, ceuRequired: 40, renewal: "2026-12-15", spend: 410 },
  { id: "m-1008", name: "Robert Kline", credential: "LAC", status: "lapsed", city: "Flagstaff", ceuDone: 22, ceuRequired: 40, renewal: "2026-04-30", spend: 760 },
  { id: "m-1009", name: "Elena Vasquez", credential: "LASAC", status: "active", city: "Yuma", ceuDone: 36, ceuRequired: 40, renewal: "2026-10-11", spend: 990 },
  { id: "m-1010", name: "Thomas Okafor", credential: "CADC", status: "active", city: "Surprise", ceuDone: 41, ceuRequired: 40, renewal: "2027-02-19", spend: 1180 },
];

// ── Admin task queue (manual work surfaced inside the AI Agent) ──────────────

export const MOCK_TASKS: MockTask[] = [
  {
    id: "t-501",
    kind: "recertification",
    title: "Recertification due — Marcus Hale (LSAT)",
    detail: "Renewal lapses in 5 days. CEUs complete (27/30). Payment outstanding.",
    member: "Marcus Hale",
    priority: "high",
    due: "Due in 5 days",
    action: "Send renewal notice",
    secondary: "Open member",
    automatable: true,
  },
  {
    id: "t-502",
    kind: "application",
    title: "New certification application — Derek Tran (CADC)",
    detail: "Submitted 2 days ago. ID verified. Awaiting transcript review.",
    member: "Derek Tran",
    priority: "high",
    due: "SLA in 1 day",
    action: "Review application",
    secondary: "Request document",
    automatable: false,
  },
  {
    id: "t-503",
    kind: "ceu_review",
    title: "CEU certificate to review — Aisha Bello",
    detail: "6.0 hrs · Trauma-Informed Care · provider verified by vision parser (0.96).",
    member: "Aisha Bello",
    priority: "medium",
    due: "Due in 3 days",
    action: "Approve CEU",
    secondary: "Flag for review",
    automatable: true,
  },
  {
    id: "t-504",
    kind: "merch",
    title: "Merch order — new branded shirts (12 units)",
    detail: "Fall conference polo shirts. Vendor quote received, awaiting PO approval.",
    member: "Operations",
    priority: "low",
    due: "Due in 9 days",
    action: "Approve order",
    secondary: "View quote",
    automatable: false,
  },
  {
    id: "t-505",
    kind: "approval",
    title: "Account approval — Priya Nair (Reciprocity)",
    detail: "Out-of-state LISAC transfer. Credential verified with issuing board.",
    member: "Priya Nair",
    priority: "medium",
    due: "Due in 2 days",
    action: "Approve account",
    secondary: "Open member",
    automatable: true,
  },
  {
    id: "t-506",
    kind: "verification",
    title: "Employer verification request — James Whitfield",
    detail: "Crisis Response Network requesting credential confirmation.",
    member: "James Whitfield",
    priority: "low",
    due: "Due in 4 days",
    action: "Confirm verification",
    automatable: true,
  },
  {
    id: "t-507",
    kind: "ceu_review",
    title: "CEU certificate to review — Elena Vasquez",
    detail: "3.0 hrs · Ethics in Counseling · future-dated anomaly flagged.",
    member: "Elena Vasquez",
    priority: "high",
    due: "Due today",
    action: "Review CEU",
    secondary: "Reject",
    automatable: false,
  },
];

// ── Insight callouts (the agent's "big takeaway" lines) ──────────────────────

export const INSIGHTS = {
  certMix:
    "LISAC and LASAC together drive 53% of all credentials issued — the independent/associate track is the core of the business. Reciprocity is the fastest-growing segment YoY.",
  revenue:
    "Renewals now account for 33% of monthly revenue — a durable recurring base. CEU fees are up 18% MoM as more members log hours through the portal.",
  recert:
    "11 credentials lapse within 30 days and 4 already have CEUs complete with payment outstanding — automating the renewal notice + invoice would recover ~$3.5K this cycle.",
  tasks:
    "5 of 23 open tasks are fully automatable today (CEU approvals on clean vision scores, verification confirmations, renewal notices). Turning these on clears roughly a third of the manual queue.",
} as const;

// ── Member-side (certificate holder) demo data ──────────────────────────────

export interface MemberTaskDemo {
  id: string;
  title: string;
  detail: string;
  due: string;
  priority: TaskPriority;
  cta: string;
  href: string;
}

export const MEMBER_TASKS_DEMO: MemberTaskDemo[] = [
  {
    id: "mt-1",
    title: "Recertification opens soon",
    detail: "Your LISAC credential renews March 2027. Start early to spread out CEUs.",
    due: "Window opens in 60 days",
    priority: "low",
    cta: "Plan renewal",
    href: "/account/renewals",
  },
  {
    id: "mt-2",
    title: "4 CEU hours to log",
    detail: "You're at 36 of 40 approved hours for this cycle. Two short courses would close it.",
    due: "Before renewal",
    priority: "medium",
    cta: "Log CEU hours",
    href: "/account/ceus",
  },
  {
    id: "mt-3",
    title: "New branded shirts available",
    detail: "Fall conference polos just dropped in the member store — members get 20% off.",
    due: "While supplies last",
    priority: "low",
    cta: "Visit store",
    href: "/store",
  },
  {
    id: "mt-4",
    title: "Confirm your supervision hours",
    detail: "Your supervisor logged 12 hours last month. Review and confirm to keep your record current.",
    due: "Due in 7 days",
    priority: "medium",
    cta: "Review hours",
    href: "/account/experience",
  },
];

/** Member CEU progress over the cycle (cumulative approved hours). */
export const MEMBER_CEU_PROGRESS: SeriesPoint[] = [
  { label: "Q1", value: 10 },
  { label: "Q2", value: 22 },
  { label: "Q3", value: 31 },
  { label: "Q4", value: 36 },
];

/** Member CEU breakdown by category (for a donut/bar). */
export const MEMBER_CEU_BY_CATEGORY: Datum[] = [
  { label: "Clinical", value: 18 },
  { label: "Ethics", value: 6 },
  { label: "Cultural", value: 6 },
  { label: "General", value: 6 },
];
