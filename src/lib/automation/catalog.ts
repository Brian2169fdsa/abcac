// ABCAC — automation workflow CATALOG + impact model.
//
// Single source of truth for human-facing workflow labels/categories and the
// "impact" tunables the analytics surface reads. Kept separate from the engine
// so UI (admin console, analytics, drilldowns) can import labels without pulling
// in dispatch/registry. The 16 workflows mirror the automation_config seed
// (migration 031); keep this list in sync when a workflow is added.

export type WorkflowCategory = "deterministic" | "agent" | "human_gate" | "observational";

export interface WorkflowMeta {
  workflow: string;
  label: string;
  category: WorkflowCategory;
  blurb: string;
}

export const WORKFLOW_CATALOG: WorkflowMeta[] = [
  { workflow: "credential_verification", label: "Credential Verification", category: "deterministic", blurb: "Auto-answer verification requests from certification records." },
  { workflow: "ceu_review", label: "CEU Review", category: "deterministic", blurb: "Approve clean CEU submissions, escalate the rest." },
  { workflow: "dunning", label: "Dunning", category: "deterministic", blurb: "Payment reminders for invoices unpaid past the grace window." },
  { workflow: "invoice_generation", label: "Invoice Generation", category: "deterministic", blurb: "Renewal invoices for certifications nearing expiration." },
  { workflow: "doc_request", label: "Document Request", category: "deterministic", blurb: "Request the missing required document on in-review applications." },
  { workflow: "payment_reconciliation", label: "Payment Reconciliation", category: "deterministic", blurb: "Match completed payments to their unpaid invoice." },
  { workflow: "certificate_issuance", label: "Certificate Issuance", category: "deterministic", blurb: "Extend renewed certifications; initial issuance escalates." },
  { workflow: "cert_sync", label: "Certification Sync", category: "deterministic", blurb: "Enable sync and approve clean cert-sync applications." },
  { workflow: "print_request", label: "Print Request", category: "deterministic", blurb: "Open the fulfillment task when a printed certificate is paid for." },
  { workflow: "account_approval", label: "Account Approval", category: "agent", blurb: "Approve clean member registrations; never auto-rejects." },
  { workflow: "name_change", label: "Name Change", category: "agent", blurb: "Apply simple name changes (proposal-capped)." },
  { workflow: "inbox_faq", label: "Inbox — FAQ", category: "agent", blurb: "Email FAQ answers to public contact-form messages." },
  { workflow: "inbox_member", label: "Inbox — Member", category: "agent", blurb: "Triage member messages with member context." },
  { workflow: "reminders", label: "Reminders", category: "observational", blurb: "Mirror each legacy reminder send into run history." },
  { workflow: "reciprocity", label: "Reciprocity", category: "human_gate", blurb: "Permanent human gate — always escalates, never automated." },
  { workflow: "refund_void", label: "Refund / Void", category: "human_gate", blurb: "Permanent human gate — always escalates, never automated." },
];

const META_BY_WORKFLOW: Record<string, WorkflowMeta> = Object.fromEntries(
  WORKFLOW_CATALOG.map((m) => [m.workflow, m]),
);

/** Title-case a snake_case workflow key as a fallback label. */
function humanize(workflow: string): string {
  return workflow
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function workflowMeta(workflow: string): WorkflowMeta | undefined {
  return META_BY_WORKFLOW[workflow];
}

export function workflowLabel(workflow: string): string {
  return META_BY_WORKFLOW[workflow]?.label ?? humanize(workflow);
}

export function isKnownWorkflow(workflow: string): boolean {
  return Object.prototype.hasOwnProperty.call(META_BY_WORKFLOW, workflow);
}

// ── Impact model (tunable estimates) ─────────────────────────────────────────
//
// Each time a workflow decision is AUTOMATED (auto-executed, or a proposal a
// human approved), it saves an estimated amount of staff handling time. These
// are deliberately conservative defaults — adjust as real handling-time data
// comes in. Escalate-only gates earn no automation credit (they always route to
// a human), so they are 0.

export const MINUTES_SAVED_PER_DECISION: Record<string, number> = {
  credential_verification: 8,
  ceu_review: 5,
  dunning: 4,
  invoice_generation: 6,
  doc_request: 4,
  payment_reconciliation: 5,
  certificate_issuance: 7,
  cert_sync: 6,
  print_request: 5,
  account_approval: 6,
  name_change: 5,
  inbox_faq: 6,
  inbox_member: 4,
  reminders: 2,
  reciprocity: 0,
  refund_void: 0,
};

/** Fallback handling-time saved for a workflow with no explicit estimate. */
export const DEFAULT_MINUTES_SAVED = 4;

/** Loaded staff hourly rate used to translate time saved into dollars. */
export const STAFF_HOURLY_RATE_USD = 35;

export function minutesSavedFor(workflow: string): number {
  const v = MINUTES_SAVED_PER_DECISION[workflow];
  return typeof v === "number" ? v : DEFAULT_MINUTES_SAVED;
}
