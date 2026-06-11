// ABCAC — workflow REGISTRATION.
//
// Each deterministic rule / agent evaluator registers itself here. `dispatch()`
// and `executeApprovedRun()` call `registerWorkflows()` before evaluating, so
// the engine always has the current evaluators regardless of which entry point
// triggered it (API route, server action, cron). Idempotent — registration runs
// at most once per process.

import { registerRule } from "../registrar";
import { credentialVerificationRule } from "./credential-verification";
import { ceuReviewRule } from "./ceu-review";
import { dunningRule } from "./dunning";
import { invoiceGenerationRule } from "./invoice-generation";
import { docRequestRule } from "./doc-request";
import { paymentReconciliationRule } from "./payment-reconciliation";
import { certificateIssuanceRule } from "./certificate-issuance";
import { reciprocityRule } from "./reciprocity";
import { refundVoidRule } from "./refund-void";

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
}
