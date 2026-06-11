// ABCAC — cert_sync deterministic rule (zero-model).
//
// Certification Sync today: a member subscribes ($15/mo) and the Stripe webhook
// flips `certifications.sync_enabled = true` for the member; admins can also
// toggle the flag per-cert on the member-detail page (cert-actions.ts). A
// cert_sync APPLICATION is the paperwork side of that flow — what a human admin
// does to approve one is exactly two writes: enable sync on the member's
// certifications and mark the application approved. This rule automates that
// happy path via ONE staged executor (`enable_cert_sync`) so both effects land
// (or fail) together. A member with NO certifications has nothing to sync —
// decisively escalate. Multiple pending cert_sync applications for the same
// member look unusual (double-submit / double-bill risk) — escalate with an
// anomaly flag instead of guessing which one to approve.
//
// The sweep pre-filters to submitted/under_review cert_sync applications; this
// rule re-validates state before staging anything.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const CERT_SYNC_RULE_VERSION = "certsync-1";

/** Application type this workflow handles (anything else is ignored). */
export const CERT_SYNC_APP_TYPE = "cert_sync";

/** Application statuses still awaiting a decision. */
export const CERT_SYNC_PENDING_STATUSES = ["submitted", "under_review"];

/** Pending cert_sync applications fetched per member (>1 already escalates). */
const PENDING_APP_SCAN_LIMIT = 5;

interface AppRow {
  id: string;
  member_id: string | null;
  app_type: string | null;
  status: string | null;
}

interface CertRow {
  id: string;
  sync_enabled: boolean | null;
}

export async function certSyncRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("applications")
    .select("id,member_id,app_type,status")
    .eq("id", input.entityId)
    .maybeSingle();
  const app = data as AppRow | null;
  if (!app || !app.member_id) return null;
  // Re-validate: only act on a still-pending cert_sync application.
  if (app.app_type !== CERT_SYNC_APP_TYPE) return null;
  if (!CERT_SYNC_PENDING_STATUSES.includes(app.status ?? "")) return null;

  // The member must have something to sync. No certifications → decisive
  // escalate; enabling sync (or approving) would be meaningless.
  const { data: certData } = await admin
    .from("certifications")
    .select("id,sync_enabled")
    .eq("member_id", app.member_id);
  const certs = (certData as CertRow[] | null) ?? [];
  if (certs.length === 0) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERT_SYNC_RULE_VERSION,
      anomalies: ["no_certifications"],
      summary:
        "Cert-sync application but the member has no certifications — nothing to sync; review manually.",
    };
  }

  // Anomaly: more than one pending cert_sync application for the same member
  // (double-submit / double-bill risk) — never guess which one to approve.
  const { data: pendingData } = await admin
    .from("applications")
    .select("id")
    .eq("member_id", app.member_id)
    .eq("app_type", CERT_SYNC_APP_TYPE)
    .in("status", CERT_SYNC_PENDING_STATUSES)
    .limit(PENDING_APP_SCAN_LIMIT);
  const pending = (pendingData as { id: string }[] | null) ?? [];
  if (pending.length > 1) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERT_SYNC_RULE_VERSION,
      anomalies: ["multiple_pending_cert_sync"],
      summary:
        `Member has ${pending.length} pending cert-sync applications ` +
        `(${pending.map((p) => p.id).join(", ")}) — resolve the duplicates manually.`,
    };
  }

  // Happy path — one executor stages BOTH effects: enable sync on the member's
  // certifications (only rows where it's still off) and approve the application.
  const toEnable = certs.filter((c) => !c.sync_enabled).length;
  return {
    decisive: true,
    tier: "auto",
    ruleVersion: CERT_SYNC_RULE_VERSION,
    action: {
      handler: "enable_cert_sync",
      args: {
        applicationId: app.id,
        memberId: app.member_id,
        expectStatus: app.status,
      },
    },
    summary:
      `Cert-sync application clean — enabling Certification Sync on ` +
      `${toEnable} of ${certs.length} certification(s) and approving the application.`,
  };
}
