// ABCAC — workflow REGISTRATION.
//
// Each deterministic rule / agent evaluator registers itself here. `dispatch()`
// and `executeApprovedRun()` call `registerWorkflows()` before evaluating, so
// the engine always has the current evaluators regardless of which entry point
// triggered it (API route, server action, cron). Idempotent — registration runs
// at most once per process.

import { registerRule } from "../registrar";
import { credentialVerificationRule } from "./credential-verification";

let registered = false;

export function registerWorkflows(): void {
  if (registered) return;
  registered = true;

  // Phase 1 — deterministic, zero-model wins (ship disabled; enable per-workflow
  // in the Automation console once verified).
  registerRule("credential_verification", credentialVerificationRule);
}
