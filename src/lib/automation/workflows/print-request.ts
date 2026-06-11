// ABCAC — print_request deterministic rule (zero-model).
//
// There is NO print_requests table: a member orders a paper certificate by
// buying the $25 "Printed Certificate Copy" catalog product, which lands as a
// `payments` row (status 'paid', slug 'printed-certificate-copy') via the
// Stripe webhook. Fulfillment is human — someone has to print and MAIL the
// thing — so this workflow's whole job is making sure that work item exists:
// when a member pays for a printed copy, automatically open a member_tasks row
// for staff ("Mail printed certificate") so the order never falls through.
//
// IDEMPOTENCY: the task detail carries a stable marker
// `[print_request:<paymentId>]`. The rule (and the executor, independently)
// look the marker up before creating anything, on top of the engine's
// one-run-per-entity dedup in the sweep. A member with no certification row
// has nothing to print — decisively escalate (likely a mistaken purchase or a
// not-yet-issued credential; a human should refund or hold the order).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const PRINT_REQUEST_RULE_VERSION = "print-1";

/** Catalog slug of the $25 paper-certificate product (src/data/products.json). */
export const PRINT_PRODUCT_SLUG = "printed-certificate-copy";

/** Sweep window — only recent paid orders are considered actionable. */
export const PRINT_RECENT_DAYS = 90;

/**
 * Stable idempotency marker embedded in the member_tasks detail. Both the rule
 * and the create_print_task executor query for it before inserting.
 */
export function printTaskMarker(paymentId: string): string {
  return `[print_request:${paymentId}]`;
}

/**
 * True when a payment row is a paper-certificate order. The slug is the
 * primary key into the catalog; the product_name match is defensive (e.g. a
 * subscription-invoice row that carries a description but an empty slug).
 */
export function isPrintProduct(slug: string | null, productName: string | null): boolean {
  if ((slug ?? "").trim() === PRINT_PRODUCT_SLUG) return true;
  return /printed certificate/i.test(productName ?? "");
}

interface PaymentRow {
  id: string;
  member_id: string | null;
  slug: string | null;
  product_name: string | null;
  status: string | null;
}

export async function printRequestRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("payments")
    .select("id,member_id,slug,product_name,status")
    .eq("id", input.entityId)
    .maybeSingle();
  const pay = data as PaymentRow | null;
  // Re-validate: only a still-paid paper-certificate order with a known member
  // is actionable. Anything else (refunded, wrong product, anonymous payment)
  // is not this workflow's business.
  if (!pay || !pay.member_id) return null;
  if (pay.status !== "paid") return null;
  if (!isPrintProduct(pay.slug, pay.product_name)) return null;

  // The member must actually HAVE a certificate to print. No certifications
  // row → decisive escalate: a human should refund or hold the order.
  const { data: certData } = await admin
    .from("certifications")
    .select("id,cert_type,cert_number,status,expiration_date")
    .eq("member_id", pay.member_id);
  const certs = (certData as { id: string }[] | null) ?? [];
  if (certs.length === 0) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: PRINT_REQUEST_RULE_VERSION,
      anomalies: ["no_certification_to_print"],
      summary:
        "Member paid for a printed certificate but has no certification on record — " +
        "nothing to print; review (refund or hold) manually.",
    };
  }

  // Already handled? A fulfillment task carrying this payment's marker means a
  // task was opened previously (by this engine or a backfill) — nothing to do.
  const marker = printTaskMarker(pay.id);
  const { data: existing } = await admin
    .from("member_tasks")
    .select("id")
    .eq("member_id", pay.member_id)
    .ilike("detail", `%${marker}%`)
    .limit(1)
    .maybeSingle();
  if (existing) return null;

  // Happy path — open the staff fulfillment task via the vetted executor.
  return {
    decisive: true,
    tier: "auto",
    ruleVersion: PRINT_REQUEST_RULE_VERSION,
    action: {
      handler: "create_print_task",
      args: { paymentId: pay.id, memberId: pay.member_id },
    },
    summary:
      `Paid printed-certificate order — opening a "Mail printed certificate" task ` +
      `for staff (member has ${certs.length} certification(s) on record).`,
  };
}
