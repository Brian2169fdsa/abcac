// ABCAC — dunning deterministic rule (zero-model).
//
// Overdue-invoice nudge: when an invoice has been UNPAID past the grace window,
// auto-send the member a payment reminder. The sweep (sweep.ts) pre-filters to
// unpaid invoices older than the window and dispatches one per invoice; this
// rule re-validates (the invoice may have been paid in the meantime) and stages
// the reminder. One nudge per invoice — idempotent via the sweep's run-dedup; a
// multi-stage escalating sequence is a later iteration.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "@/lib/format";
import { DAY_MS } from "../time";
import type { DispatchInput, RuleResult } from "../types";

export const DUNNING_RULE_VERSION = "dunning-1";

/** Grace period before an unpaid invoice earns a reminder. */
export const DUNNING_AGE_DAYS = 14;

interface InvoiceRow {
  id: string;
  member_id: string | null;
  status: string | null;
  invoice_number: string | null;
  amount_cents: number | null;
  created_at: string | null;
}

function ageDays(iso: string | null, now: Date): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (now.getTime() - t) / DAY_MS;
}

export async function dunningRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("invoices")
    .select("id,member_id,status,invoice_number,amount_cents,created_at")
    .eq("id", input.entityId)
    .maybeSingle();
  const inv = data as InvoiceRow | null;
  if (!inv || !inv.member_id) return null;
  // Re-validate: only nudge a still-unpaid invoice past the grace window.
  if (inv.status !== "unpaid") return null;
  if (ageDays(inv.created_at, new Date()) < DUNNING_AGE_DAYS) return null;

  const num = inv.invoice_number ?? "your invoice";
  const amount =
    typeof inv.amount_cents === "number" ? formatCents(inv.amount_cents) : "the balance";

  return {
    decisive: true,
    tier: "auto",
    ruleVersion: DUNNING_RULE_VERSION,
    action: {
      handler: "send_member_message",
      args: {
        memberId: inv.member_id,
        subject: `Payment reminder — invoice ${num}`,
        body:
          `Our records show invoice ${num} for ${amount} is still unpaid. ` +
          `Please sign in to your member portal to complete payment and keep your certification in good standing. ` +
          `If you've already paid, thank you — no further action is needed.`,
      },
    },
    summary: `Overdue-payment reminder queued for invoice ${num}.`,
  };
}
