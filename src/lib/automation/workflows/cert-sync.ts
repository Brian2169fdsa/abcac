// ABCAC — cert_sync deterministic rule (zero-model).
//
// Certification Sync: the member selects two or more of their own active
// certifications; the portal computes a real plan (target expiration date +
// per-credential month shift) from their actual expiration dates and stores
// it on the application at submission. Approving one is exactly two writes,
// both applying that stored plan: set every selected certification's
// expiration date to the target and flip sync_enabled, then mark the
// application approved. This rule automates that happy path via ONE staged
// executor (`enable_cert_sync`, in registry.ts) which delegates to
// applyCertSyncPlan() — the same function the admin cockpit's manual "Apply
// synchronized dates" button uses. A request with no valid stored plan (a
// paper upload, or one saved before this plan format existed) has nothing an
// automated rule can safely apply — decisively escalate. Multiple pending
// cert_sync applications for the same member look unusual (double-submit /
// double-bill risk) — escalate with an anomaly flag instead of guessing which
// one to approve.
//
// The sweep pre-filters to submitted/under_review cert_sync applications; this
// rule re-validates state before staging anything.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";
import { parseStoredCertSyncPlan } from "./cert-sync-apply";

export const CERT_SYNC_RULE_VERSION = "certsync-1";

/** Application type this workflow handles (anything else is ignored). */
export const CERT_SYNC_APP_TYPE = "cert_sync";

/** Application statuses still awaiting a decision. */
export const CERT_SYNC_PENDING_STATUSES = ["under_review"];

/** Pending cert_sync applications fetched per member (>1 already escalates). */
const PENDING_APP_SCAN_LIMIT = 5;

interface AppRow {
  id: string;
  member_id: string | null;
  app_type: string | null;
  status: string | null;
  member_notes: string | null;
}

export async function certSyncRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("applications")
    .select("id,member_id,app_type,status,member_notes")
    .eq("id", input.entityId)
    .maybeSingle();
  const app = data as AppRow | null;
  if (!app || !app.member_id) return null;
  // Re-validate: only act on a still-pending cert_sync application.
  if (app.app_type !== CERT_SYNC_APP_TYPE) return null;
  if (!CERT_SYNC_PENDING_STATUSES.includes(app.status ?? "")) return null;

  // The application must carry a real, computed plan (target date + at least
  // two credential ids) to apply automatically. A paper upload, or a legacy
  // submission saved before this plan format existed, has nothing an
  // automated rule can safely apply — decisive escalate.
  const plan = parseStoredCertSyncPlan(app.member_notes);
  if (!plan) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CERT_SYNC_RULE_VERSION,
      anomalies: ["no_sync_plan"],
      summary:
        "Cert-sync application has no computed synchronization plan (paper upload, or saved before " +
        "the digital plan format existed) — review and apply manually.",
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

  // Happy path — one executor applies the stored plan (real target date on
  // each selected certification) and approves the application.
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
      `Cert-sync application clean — synchronizing ${plan.items.length} certification(s) to ` +
      `${plan.targetExpiration} and approving the application.`,
  };
}
