// ABCAC — automation tiering (pure, unit-tested).
//
// Maps a confidence score + anomaly flags + the workflow's configured thresholds
// to a decision tier. The anomaly trip is absolute: ANY anomaly forces escalate,
// regardless of confidence (future-dated CEU, duplicate hash, amount mismatch…).

import type { AutomationTier, WorkflowConfig } from "./types";

export function tierFor(
  confidence: number,
  anomalies: string[],
  cfg: Pick<WorkflowConfig, "auto" | "propose">,
): AutomationTier {
  // Anomaly trip — never auto/propose when something looks off.
  if (anomalies.length > 0) return "escalate";
  if (cfg.auto != null && confidence >= cfg.auto) return "auto";
  if (cfg.propose != null && confidence >= cfg.propose) return "propose";
  return "escalate";
}
