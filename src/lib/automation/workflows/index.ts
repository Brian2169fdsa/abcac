// ABCAC — workflow REGISTRATION.
//
// Each deterministic rule / agent evaluator registers itself here. `dispatch()`
// and `executeApprovedRun()` call `registerWorkflows()` before evaluating, so
// the engine always has the current evaluators regardless of which entry point
// triggered it (API route, server action, cron). Idempotent — registration runs
// at most once per process.

import { registerRule, registerAgent } from "../registrar";
import { credentialVerificationRule } from "./credential-verification";
import { ceuReviewRule } from "./ceu-review";
import { dunningRule } from "./dunning";
import { invoiceGenerationRule } from "./invoice-generation";
import { docRequestRule } from "./doc-request";
import { paymentReconciliationRule } from "./payment-reconciliation";
import { certificateIssuanceRule } from "./certificate-issuance";
import { reciprocityRule } from "./reciprocity";
import { refundVoidRule } from "./refund-void";
import { accountApprovalRule, accountApprovalAgent } from "./account-approval";
import { nameChangeRule, nameChangeAgent } from "./name-change";
import { inboxFaqRule, inboxFaqAgent } from "./inbox-faq";
import { inboxMemberRule } from "./inbox-member";

let registered = false;

export function registerWorkflows(): void {
  if (registered) return;
  registered = true;

  // Phase 1 — deterministic, zero-model wins (ship disabled; enable per-workflow
  // in the Automation console once verified).
  registerRule("credential_verification", credentialVerificationRule);
  registerRule("ceu_review", ceuReviewRule);
  registerRule("dunning", dunningRule);
  registerRule("invoice_generation", invoiceGenerationRule);
  registerRule("doc_request", docRequestRule);

  // Phase 1, batch 3 — money/credential workflows. payment_reconciliation and
  // certificate_issuance auto-execute only their narrow happy paths; reciprocity
  // and refund_void are PERMANENT human gates (always escalate, never an action).
  registerRule("payment_reconciliation", paymentReconciliationRule);
  registerRule("certificate_issuance", certificateIssuanceRule);
  registerRule("reciprocity", reciprocityRule);
  registerRule("refund_void", refundVoidRule);

  // Phase 2 — model-evaluated workflows: the rule gates the hard cases, the
  // agent (Claude) weighs the rest. Without ANTHROPIC_API_KEY the agents return
  // null and dispatch escalates with "no_evaluator". Still ship disabled.
  registerRule("account_approval", accountApprovalRule);
  registerAgent("account_approval", accountApprovalAgent);
  registerRule("name_change", nameChangeRule);
  registerAgent("name_change", nameChangeAgent);

  // INBOX workflows. inbox_faq: rule gates (bad address / member sender /
  // sensitive content), then the agent matches the message against the built-in
  // FAQ pack — only a >= 0.90 match auto-sends a reply (migration 031 seeds
  // propose NULL, so anything less escalates). inbox_member: escalate-only
  // triage (both thresholds NULL) — the rule is always decisive and carries a
  // member-context summary; no agent registered (add one later by returning
  // null from the rule for the cases the agent should weigh).
  registerRule("inbox_faq", inboxFaqRule);
  registerAgent("inbox_faq", inboxFaqAgent);
  registerRule("inbox_member", inboxMemberRule);
}
