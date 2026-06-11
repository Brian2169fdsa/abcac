// ABCAC — refund_void rule (PERMANENT HUMAN GATE — escalate-only).
//
// Moving money OUT (refunding a payment / voiding an invoice) is never
// automated. There is no sweep for this workflow; it is dispatched ad hoc when
// refund intent appears (member request, chargeback signal, admin tooling).
// This rule is registered so that even then, the deterministic pass is always
// decisive at tier "escalate" with NO staged action — the dispatcher records an
// escalated run and a human takes it from there. No refund executor exists in
// the registry, so an automated refund cannot run even by mistake.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "@/lib/format";
import type { DispatchInput, RuleResult } from "../types";

export const REFUND_VOID_RULE_VERSION = "refund-1";

interface InvoiceRow {
  id: string;
  member_id: string | null;
  invoice_number: string | null;
  status: string | null;
  amount_cents: number | null;
  paid_at: string | null;
}

export async function refundVoidRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  // Always decisive, always escalate — never an action, regardless of state.
  const base = {
    decisive: true as const,
    tier: "escalate" as const,
    ruleVersion: REFUND_VOID_RULE_VERSION,
  };

  if (!input.entityId) {
    return { ...base, anomalies: ["missing_entity"], summary: "Refund/void request with no invoice id — review manually." };
  }

  const { data } = await admin
    .from("invoices")
    .select("id,member_id,invoice_number,status,amount_cents,paid_at")
    .eq("id", input.entityId)
    .maybeSingle();
  const inv = data as InvoiceRow | null;
  if (!inv) {
    return { ...base, anomalies: ["not_found"], summary: "Refund/void requested for an invoice that does not exist — review manually." };
  }

  const num = inv.invoice_number ?? inv.id;
  const amount =
    typeof inv.amount_cents === "number" ? formatCents(inv.amount_cents) : "unknown amount";
  const paid = inv.paid_at ? `, paid ${inv.paid_at.slice(0, 10)}` : "";

  return {
    ...base,
    summary:
      `Refund/void intent on invoice ${num} (${amount}, status ${inv.status ?? "unknown"}${paid}). ` +
      `Refunds and voids are never automated — human decision required.`,
  };
}
