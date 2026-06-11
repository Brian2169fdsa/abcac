// ABCAC — reciprocity rule (PERMANENT HUMAN GATE — escalate-only).
//
// IC&RC reciprocity transfers are inter-board legal/credential transactions and
// stay human-decided forever (see EXECUTION-PLAN Phase 4: "reciprocity ... stays
// permanent-escalate"). This rule never stages an action and never tiers below
// "escalate": its only job is to surface each pending request in the
// Needs-Attention queue with a useful summary (direction, credential,
// destination, fee paid?). The dispatch.ts comment "reciprocity always
// escalates" refers to this rule.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "@/lib/format";
import type { DispatchInput, RuleResult } from "../types";

export const RECIPROCITY_RULE_VERSION = "recip-1";

interface ReciprocityRow {
  id: string;
  member_id: string | null;
  direction: string | null;
  credential: string | null;
  destination: string | null;
  status: string | null;
  payment_status: string | null;
  fee_cents: number | null;
}

const DIRECTION_LABEL: Record<string, string> = {
  out_of_az: "out of Arizona",
  into_az: "into Arizona",
  international: "international",
};

export async function reciprocityRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  // Always decisive, always escalate — never an action, regardless of state.
  const base = {
    decisive: true as const,
    tier: "escalate" as const,
    ruleVersion: RECIPROCITY_RULE_VERSION,
  };

  if (!input.entityId) {
    return { ...base, anomalies: ["missing_entity"], summary: "Reciprocity request with no entity id — review manually." };
  }

  const { data } = await admin
    .from("reciprocity_requests")
    .select("id,member_id,direction,credential,destination,status,payment_status,fee_cents")
    .eq("id", input.entityId)
    .maybeSingle();
  const req = data as ReciprocityRow | null;
  if (!req) {
    return { ...base, anomalies: ["not_found"], summary: "Reciprocity request not found — review manually." };
  }

  const dir = DIRECTION_LABEL[req.direction ?? ""] ?? req.direction ?? "unknown direction";
  const fee =
    typeof req.fee_cents === "number" ? `${formatCents(req.fee_cents)} fee` : "fee";
  const paid = req.payment_status === "paid" ? `${fee} paid` : `${fee} not paid`;

  return {
    ...base,
    summary:
      `IC&RC reciprocity (${dir}) — ${req.credential ?? "unspecified credential"} → ` +
      `${req.destination ?? "unspecified destination"}; ${paid}; status ${req.status ?? "unknown"}. ` +
      `Human review required (reciprocity never automates).`,
  };
}
