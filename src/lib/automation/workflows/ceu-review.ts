// ABCAC — ceu_review deterministic rule (zero-model, escalate-path).
//
// Phase-1 behavior: every pending CEU submission becomes an automation_runs row
// so the Needs-Attention queue reflects the real CEU backlog, with cheap
// deterministic ANOMALY FLAGS attached (future-dated completion, implausible
// hours). The rule is decisive→escalate in all cases for now: a human still
// makes every CEU call.
//
// When the document-vision agent is enabled (ANTHROPIC_API_KEY set), the CLEAN
// branch below becomes non-decisive so the agent pass can propose/auto on a high
// confidence parse — the anomaly trip still forces escalate regardless. That
// switch is intentionally deferred to the vision batch; see workflows/index.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const CEU_REVIEW_RULE_VERSION = "ceu-1";

/** Max plausible CEU hours for a single submitted certificate. */
const MAX_PLAUSIBLE_HOURS = 60;

interface CeuRow {
  id: string;
  status: string | null;
  hours: number | string | null;
  completion_date: string | null;
  course_name: string | null;
}

/** True when a YYYY-MM-DD date string parses to a day after `now`. */
function isFutureDate(value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  return ts > now.getTime();
}

export async function ceuReviewRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("ceu_records")
    .select("id,status,hours,completion_date,course_name")
    .eq("id", input.entityId)
    .maybeSingle();
  const rec = data as CeuRow | null;
  if (!rec) return null;
  // Already reviewed (approved/rejected) — nothing to queue.
  if (rec.status && rec.status !== "pending") return null;

  const anomalies: string[] = [];
  if (isFutureDate(rec.completion_date)) anomalies.push("future_dated");
  const hrs = typeof rec.hours === "number" ? rec.hours : Number(rec.hours);
  if (!Number.isFinite(hrs) || hrs <= 0 || hrs > MAX_PLAUSIBLE_HOURS) {
    anomalies.push("implausible_hours");
  }

  const course = rec.course_name ?? "CEU";
  return {
    decisive: true,
    tier: "escalate",
    ruleVersion: CEU_REVIEW_RULE_VERSION,
    anomalies,
    summary: anomalies.length
      ? `CEU "${course}" flagged: ${anomalies.join(", ")} — needs manual review.`
      : `CEU "${course}" — no automated anomalies; ready for reviewer.`,
  };
}
