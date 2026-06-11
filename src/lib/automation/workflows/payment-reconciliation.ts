// ABCAC — payment_reconciliation deterministic rule (zero-model).
//
// Match money to paper: when a completed Stripe payment exists for a member who
// still has an UNPAID invoice of the exact same amount, auto-mark that invoice
// paid (the webhook only closes invoices it was told about via metadata — admin
// invoices paid out-of-band stay open). The sweep pre-filters to paid payments
// that have at least one matching unpaid invoice; this rule re-validates and
// requires EXACTLY ONE candidate — any ambiguity (two same-amount unpaid
// invoices) is decisively escalated to a human, never guessed.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const PAYMENT_RECONCILIATION_RULE_VERSION = "payrec-1";

/**
 * payments.status values that mean money actually arrived. The Stripe webhook
 * writes "paid" (src/app/api/stripe/webhook/route.ts) and the finance pages
 * filter on it; "completed"/"succeeded" are accepted defensively for manual or
 * legacy rows (the column has no CHECK constraint).
 */
export const PAID_PAYMENT_STATUSES = ["paid", "completed", "succeeded"];

/** Max candidate invoices fetched when matching (>1 already escalates). */
export const INVOICE_MATCH_LIMIT = 5;

interface PaymentRow {
  id: string;
  member_id: string | null;
  status: string | null;
  amount_cents: number | null;
  stripe_session_id: string | null;
  product_name: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  status: string | null;
  amount_cents: number | null;
}

export async function paymentReconciliationRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("payments")
    .select("id,member_id,status,amount_cents,stripe_session_id,product_name")
    .eq("id", input.entityId)
    .maybeSingle();
  const pay = data as PaymentRow | null;
  if (!pay || !pay.member_id) return null;
  // Re-validate: only reconcile money that actually arrived.
  if (!PAID_PAYMENT_STATUSES.includes(pay.status ?? "")) return null;
  if (typeof pay.amount_cents !== "number" || pay.amount_cents <= 0) return null;

  const { data: invData } = await admin
    .from("invoices")
    .select("id,invoice_number,status,amount_cents")
    .eq("member_id", pay.member_id)
    .eq("status", "unpaid")
    .eq("amount_cents", pay.amount_cents)
    .limit(INVOICE_MATCH_LIMIT);
  const candidates = (invData as InvoiceRow[] | null) ?? [];
  if (candidates.length === 0) return null; // nothing to reconcile

  const amount = `$${(pay.amount_cents / 100).toLocaleString("en-US")}`;

  if (candidates.length > 1) {
    const nums = candidates.map((c) => c.invoice_number ?? c.id).join(", ");
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: PAYMENT_RECONCILIATION_RULE_VERSION,
      anomalies: ["ambiguous_invoice_match"],
      summary:
        `Payment of ${amount} (${pay.product_name ?? "unnamed product"}) matches ` +
        `${candidates.length} unpaid invoices (${nums}) — reconcile manually.`,
    };
  }

  const inv = candidates[0];
  const num = inv.invoice_number ?? inv.id;
  return {
    decisive: true,
    tier: "auto",
    ruleVersion: PAYMENT_RECONCILIATION_RULE_VERSION,
    action: {
      handler: "mark_invoice_paid",
      args: {
        invoiceId: inv.id,
        memberId: pay.member_id,
        stripeSessionId: pay.stripe_session_id,
      },
    },
    summary: `Payment of ${amount} reconciled to unpaid invoice ${num} — marking paid.`,
  };
}
