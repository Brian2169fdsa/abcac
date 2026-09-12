// ABCAC — shared core for actually applying a Certification Sync request.
//
// Both the manual admin action (member cockpit) and the automation executor
// (enable_cert_sync, staged by certSyncRule) must do the exact same thing:
// take the plan computed and stored at submission time — real certification
// ids, the target expiration date, per-credential month shifts — and write
// it. Sharing one function means there is exactly one place that can get the
// "which certifications, which new date" question wrong.
//
// The plan is never recomputed here. It was already built authoritatively by
// buildCertSyncPlan() in src/lib/cert-sync.ts when the member submitted (and
// is what the $15/month fee they paid was calculated from) — recomputing at
// approval time could silently apply a different date than what was quoted
// and charged. What IS re-checked here is that every certification in the
// plan still belongs to this member and is still active; anything else fails
// closed rather than guessing.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface StoredCertSyncPlan {
  targetExpiration: string;
  items: Array<{ id: string; monthsForward: number }>;
  totalMonths: number;
  totalFeeCents: number;
}

export interface ApplicationForSync {
  id: string;
  member_id: string | null;
  app_type: string | null;
  status: string | null;
  member_notes: string | null;
}

export type ApplyCertSyncResult =
  | { ok: true; appliedCertIds: string[]; targetExpiration: string }
  | { ok: false; error: string };

export function parseStoredCertSyncPlan(memberNotes: string | null): StoredCertSyncPlan | null {
  if (!memberNotes) return null;
  try {
    const details = JSON.parse(memberNotes) as { requestKind?: string; plan?: StoredCertSyncPlan | null };
    if (details.requestKind !== "certification_sync") return null;
    const plan = details.plan;
    if (!plan || !plan.targetExpiration || !Array.isArray(plan.items) || plan.items.length < 2) return null;
    return plan;
  } catch {
    return null;
  }
}

/**
 * Applies a submitted (and normally paid) Certification Sync application:
 * sets the stored target expiration date on every certification in the plan
 * that still belongs to the member and is still active, flips
 * `sync_enabled`, and marks the application approved. Idempotent — an
 * already-approved application is a successful no-op.
 */
export async function applyCertSyncPlan(
  admin: SupabaseClient,
  application: ApplicationForSync,
): Promise<ApplyCertSyncResult> {
  if (application.app_type !== "cert_sync") return { ok: false, error: "bad_state" };
  if (!application.member_id) return { ok: false, error: "bad_state" };
  if (application.status === "approved") {
    // Sync was already applied when this was first approved — nothing to redo.
    return { ok: true, appliedCertIds: [], targetExpiration: "" };
  }
  if (!["submitted", "under_review"].includes(application.status ?? "")) {
    return { ok: false, error: "state_moved" };
  }

  const plan = parseStoredCertSyncPlan(application.member_notes);
  if (!plan) {
    // A paper submission, or a digital one saved before this plan format
    // existed, has no structured plan to apply automatically.
    return { ok: false, error: "no_plan" };
  }

  const planIds = plan.items.map((item) => item.id);
  const { data: certData } = await admin
    .from("certifications")
    .select("id,status")
    .eq("member_id", application.member_id)
    .in("id", planIds);
  const validIds = ((certData as { id: string; status: string | null }[] | null) ?? [])
    .filter((c) => c.status === "active")
    .map((c) => c.id);
  if (validIds.length < 2) {
    return { ok: false, error: "certifications_changed" };
  }

  const { error: certErr } = await admin
    .from("certifications")
    .update({ expiration_date: plan.targetExpiration, sync_enabled: true })
    .eq("member_id", application.member_id)
    .in("id", validIds);
  if (certErr) return { ok: false, error: certErr.message };

  const { error: appErr } = await admin
    .from("applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", application.id)
    .eq("status", application.status); // guard: lose the race rather than re-decide
  if (appErr) {
    // Certification dates may already be written (idempotent on retry) but the
    // application update failed — surface it distinctly so a human reconciles.
    return { ok: false, error: `application_update_failed:${appErr.message}` };
  }

  return { ok: true, appliedCertIds: validIds, targetExpiration: plan.targetExpiration };
}
