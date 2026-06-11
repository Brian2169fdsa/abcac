// ABCAC — invoice_generation deterministic rule (zero-model).
//
// Renewal billing: when an ACTIVE certification is approaching expiration, auto-
// create the renewal invoice so the member can pay before lapsing. The sweep
// pre-filters to active certs expiring within the window and dispatches one per
// cert; this rule re-validates and stages the invoice. The create_invoice
// executor is itself idempotent (no duplicate unpaid invoice with the same
// description), so a re-run never double-bills.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCents } from "@/lib/format";
import { DAY_MS } from "../time";
import type { DispatchInput, RuleResult } from "../types";

export const INVOICE_GENERATION_RULE_VERSION = "invgen-1";

/** Generate the renewal invoice when a cert expires within this window. */
export const RENEWAL_WINDOW_DAYS = 60;

/** Biennial renewal fee, in cents (matches the standard renewal line item). */
export const RENEWAL_FEE_CENTS = 15000;

interface CertRow {
  id: string;
  member_id: string | null;
  cert_type: string | null;
  status: string | null;
  expiration_date: string | null;
}

function daysUntil(date: string | null, now: Date): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / DAY_MS;
}

export async function invoiceGenerationRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("certifications")
    .select("id,member_id,cert_type,status,expiration_date")
    .eq("id", input.entityId)
    .maybeSingle();
  const cert = data as CertRow | null;
  if (!cert || !cert.member_id) return null;
  // Re-validate: only bill an active cert inside the renewal window.
  if (cert.status !== "active") return null;
  const days = daysUntil(cert.expiration_date, new Date());
  if (days === null || days < 0 || days > RENEWAL_WINDOW_DAYS) return null;

  const type = cert.cert_type ?? "certification";
  const description = `Biennial certification renewal — ${type}`;

  return {
    decisive: true,
    tier: "auto",
    ruleVersion: INVOICE_GENERATION_RULE_VERSION,
    action: {
      handler: "create_invoice",
      args: {
        memberId: cert.member_id,
        description,
        amountCents: RENEWAL_FEE_CENTS,
        certId: cert.id,
      },
    },
    summary: `Renewal invoice (${formatCents(RENEWAL_FEE_CENTS)}) generated for ${type} expiring in ${Math.round(days)} days.`,
  };
}
