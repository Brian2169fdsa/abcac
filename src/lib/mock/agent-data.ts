/**
 * Demo dataset for the member (certificate-holder) agent dashboard.
 * All data is synthetic — suitable for preview / demo environments.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface MemberTaskDemo {
  id: string;
  title: string;
  detail: string;
  due: string;        // ISO date string
  priority: "low" | "normal" | "high";
  cta: string;        // button label
  href: string;       // link target
}

export interface Datum {
  label: string;
  value: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

// ── CEU analytics ─────────────────────────────────────────────────────────

/** Cumulative approved CEU hours by quarter for the current 2-year cycle. */
export const MEMBER_CEU_PROGRESS: SeriesPoint[] = [
  { label: "Q1 2024", value: 4 },
  { label: "Q2 2024", value: 11 },
  { label: "Q3 2024", value: 18 },
  { label: "Q4 2024", value: 24 },
  { label: "Q1 2025", value: 30 },
  { label: "Q2 2025", value: 36 },
];

/** CEU hours earned, broken down by category. */
export const MEMBER_CEU_BY_CATEGORY: Datum[] = [
  { label: "Professional Ethics", value: 6 },
  { label: "Cultural Competency", value: 5 },
  { label: "Clinical Practice", value: 14 },
  { label: "Co-Occurring Disorders", value: 7 },
  { label: "Supervision & Leadership", value: 4 },
];

// ── Personalized task cards ────────────────────────────────────────────────

export const MEMBER_TASKS_DEMO: MemberTaskDemo[] = [
  {
    id: "task-1",
    title: "Submit Supervision Hours Form",
    detail:
      "Upload your completed supervision log for Q2 so your renewal application can be processed on time.",
    due: "2025-07-15",
    priority: "high",
    cta: "Upload Now",
    href: "/account/documents",
  },
  {
    id: "task-2",
    title: "Complete Ethics CEU Requirement",
    detail:
      "You still need 3 hours in Professional Ethics to satisfy IC&RC's mandatory category requirement.",
    due: "2025-08-31",
    priority: "high",
    cta: "Find Courses",
    href: "/account/ceus",
  },
  {
    id: "task-3",
    title: "Verify Contact Information",
    detail:
      "Confirm your mailing address and phone number are current before your certificate is mailed.",
    due: "2025-07-30",
    priority: "normal",
    cta: "Review Profile",
    href: "/account/profile",
  },
  {
    id: "task-4",
    title: "Review Renewal Fee Invoice",
    detail:
      "An invoice for your 2-year credential renewal fee has been generated. Pay before the due date to avoid late fees.",
    due: "2025-09-01",
    priority: "normal",
    cta: "Pay Invoice",
    href: "/account/renew",
  },
];
