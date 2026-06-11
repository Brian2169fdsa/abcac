// ABCAC — certificate_issuance deterministic rule (zero-model, hard paid-guard).
//
// Approved application → credential effect, but ONLY behind the M3 paid-guard:
// an approved application with no money behind it always escalates ("approved
// but unpaid"), never issues. For a paid RENEWAL with an active certification,
// auto-extend the expiration two years from max(today, current expiration).
// For a paid INITIAL certification, escalate anyway — minting a brand-new cert
// number is a human ceremony for now, so the engine never inserts
// certifications rows; it just tees the work up ("ready to issue").
//
// The sweep pre-filters to approved initial/renewal applications; this rule
// re-validates state, runs the paid-guard, and stages at most one extension.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";
import { isoDate } from "../time";
import { PAID_PAYMENT_STATUSES } from "./payment-reconciliation";

export const CERTIFICATE_ISSUANCE_RULE_VERSION = "certissue-1";

/** A renewal pushes the expiration out this many years. */
export const CERT_EXTENSION_YEARS = 2;

/** Application types this workflow handles (anything else is ignored). */
export const ISSUANCE_APP_TYPES = ["initial_certification", "renewal"];

/** Paid invoices scanned for a renewal line item (description match in TS). */
const PAID_INVOICE_SCAN_LIMIT = 50;

interface AppRow {
  id: string;
  member_id: string | null;
  app_type: string | null;
  status: string | null;
  cert_type: string | null;
}

interface CertRow {
  id: string;
  member_id: string | null;
  status: string | null;
  cert_type: string | null;
  expiration_date: string | null;
}

/** New expiration: CERT_EXTENSION_YEARS from max(today, current expiration). */
export function renewalTargetExpiration(currentExpiration: string | null, now = new Date()): string {
  const cur = currentExpiration ? Date.parse(currentExpiration) : NaN;
  const base = new Date(Number.isNaN(cur) ? now.getTime() : Math.max(cur, now.getTime()));
  base.setUTCFullYear(base.getUTCFullYear() + CERT_EXTENSION_YEARS);
  return isoDate(base);
}

/**
 * M3 paid-guard — true when the member has money behind the application:
 * a PAID invoice whose description mentions "renewal", or a completed payment
 * recorded against this application id.
 */
export async function applicationPaid(
  admin: SupabaseClient,
  memberId: string,
  applicationId: string,
): Promise<boolean> {
  const { data: invData } = await admin
    .from("invoices")
    .select("id,description")
    .eq("member_id", memberId)
    .eq("status", "paid")
    .limit(PAID_INVOICE_SCAN_LIMIT);
  const invoices = (invData as { description: string | null }[] | null) ?? [];
  if (invoices.some((i) => (i.description ?? "").toLowerCase().includes("renewal"))) return true;

  const { data: pay } = await admin
    .from("payments")
    .select("id")
    .eq("application_id", applicationId)
    .in("status", PAID_PAYMENT_STATUSES)
    .limit(1)
    .maybeSingle();
  return Boolean(pay);
}

export async function certificateIssuanceRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("applications")
    .select("id,member_id,app_type,status,cert_type")
    .eq("id", input.entityId)
    .maybeSingle();
  const app = data as AppRow | null;
  if (!app || !app.member_id) return null;
  // Re-validate: only act on a still-approved initial/renewal application.
  if (app.status !== "approved") return null;
  if (!ISSUANCE_APP_TYPES.includes(app.app_type ?? "")) return null;

  const label = (app.app_type as string).replace(/_/g, " ");

  // M3 — no credential effect without money behind it. Ever.
  if (!(await applicationPaid(admin, app.member_id, app.id))) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERTIFICATE_ISSUANCE_RULE_VERSION,
      anomalies: ["approved_unpaid"],
      summary: `Application (${label}) approved but unpaid — no paid invoice or completed payment found.`,
    };
  }

  if (app.app_type === "initial_certification") {
    // Paid + approved, but a new cert number is assigned by a human.
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERTIFICATE_ISSUANCE_RULE_VERSION,
      summary: `Initial certification (${app.cert_type ?? "unspecified type"}) approved and paid — ready to issue; needs cert number assignment.`,
    };
  }

  // Renewal — extend the member's active certification.
  const { data: certData } = await admin
    .from("certifications")
    .select("id,member_id,status,cert_type,expiration_date")
    .eq("member_id", app.member_id)
    .eq("status", "active")
    .order("expiration_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cert = certData as CertRow | null;
  if (!cert) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERTIFICATE_ISSUANCE_RULE_VERSION,
      anomalies: ["no_active_certification"],
      summary: "Renewal approved and paid but the member has no active certification to extend — review manually.",
    };
  }

  const target = renewalTargetExpiration(cert.expiration_date);
  return {
    decisive: true,
    tier: "auto",
    ruleVersion: CERTIFICATE_ISSUANCE_RULE_VERSION,
    action: {
      handler: "extend_certification",
      args: {
        certId: cert.id,
        memberId: app.member_id,
        targetExpiration: target,
      },
    },
    summary: `Renewal approved and paid — extending ${cert.cert_type ?? "certification"} to ${target}.`,
  };
}
