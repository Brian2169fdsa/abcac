// ABCAC — automation SWEEP (cron-driven trigger for scan-based workflows).
//
// Some entities are created by client-side inserts (e.g. CEU submissions go
// straight to Postgres from the member form), so there's no server hook to call
// dispatch() at write time. The sweep is the uniform trigger: on a schedule it
// scans for actionable rows and hands each to dispatch(), skipping anything that
// already has an automation_runs row for that workflow (idempotent — a row is
// processed at most once). Scans are gated on the workflow being enabled, so a
// disabled workflow does no work.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowConfig, isGloballyPaused } from "./config";
import { dispatch } from "./dispatch";

/** True when an automation_runs row already exists for (workflow, entityId). */
export async function hasExistingRun(
  admin: SupabaseClient,
  workflow: string,
  entityId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("automation_runs")
    .select("id")
    .eq("workflow", workflow)
    .eq("entity_id", entityId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export interface SweepResult {
  scanned: number;
  dispatched: number;
}

/** Dispatch every still-pending CEU record that hasn't been processed yet. */
export async function sweepCeuReview(admin: SupabaseClient, limit = 100): Promise<SweepResult> {
  const { data } = await admin
    .from("ceu_records")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "ceu_review", r.id)) continue;
    await dispatch({
      workflow: "ceu_review",
      entityType: "ceu_record",
      entityId: r.id,
      memberId: r.member_id,
    });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/**
 * Run all scan-based deterministic workflows. Each scan only runs when its
 * workflow is enabled (so a disabled workflow costs nothing). Honors the global
 * pause. Best-effort per workflow — one failing scan doesn't abort the others.
 */
export async function runAutomationSweep(): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  if (await isGloballyPaused(admin)) return { paused: true };

  const out: Record<string, unknown> = {};

  const ceuCfg = await getWorkflowConfig(admin, "ceu_review");
  if (ceuCfg?.enabled) {
    try {
      out.ceu_review = await sweepCeuReview(admin);
    } catch (err) {
      out.ceu_review = { error: err instanceof Error ? err.message : "sweep_failed" };
    }
  } else {
    out.ceu_review = { skipped: "disabled" };
  }

  return out;
}
