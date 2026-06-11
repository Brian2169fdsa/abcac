"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { executeApprovedRun, rejectRun } from "@/lib/automation/dispatch";
import { runAutomationSweep } from "@/lib/automation/sweep";

// Admin automation-console actions. Every action RE-READS the caller's
// portal_role from the cookie-bound session server-side and gates with
// `isAdminRole` before touching the automation engine — the client never
// carries authorization. Mirrors the security shape of cockpit-actions.ts.

type ActionResult = { ok: true } | { ok: false; error: string };

export type SweepActionResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string };

const PAGE = "/admin/automation";

/** Re-read the caller from the cookie session. Returns the user id + role. */
async function requireCaller(): Promise<
  | { ok: true; userId: string; role: string | null }
  | { ok: false; error: string }
> {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  return { ok: true, userId: user.id, role: profile?.portal_role ?? null };
}

/** Approve a pending proposal — runs its staged action through the registry. ADMIN-GATED. */
export async function approveAutomationRun(runId: string): Promise<ActionResult> {
  if (!runId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const result = await executeApprovedRun(runId, caller.userId);
  if (!result.ok) return { ok: false, error: result.error ?? "execute_failed" };

  revalidatePath(PAGE);
  return { ok: true };
}

/** Reject a pending proposal — no action runs. ADMIN-GATED. */
export async function rejectAutomationRun(runId: string): Promise<ActionResult> {
  if (!runId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const result = await rejectRun(runId, caller.userId);
  if (!result.ok) return { ok: false, error: result.error ?? "reject_failed" };

  revalidatePath(PAGE);
  return { ok: true };
}

/**
 * Dismiss an ESCALATED run — marks it rejected (no staged action ever runs for
 * an escalation; the admin handles the underlying entity manually). ADMIN-GATED.
 * The UPDATE is guarded on `status = 'escalated'` so it can never flip a
 * pending/approved/auto-executed run, and the dismissal is audited.
 */
export async function resolveEscalatedRun(runId: string): Promise<ActionResult> {
  if (!runId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("automation_runs")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: caller.userId,
    })
    .eq("id", runId)
    .eq("status", "escalated")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_escalated" };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "automation_escalation_dismissed",
      target_table: "automation_runs",
      target_id: runId,
      details: { run_id: runId },
      actor_type: "human",
      automation_run_id: runId,
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(PAGE);
  return { ok: true };
}

/**
 * Manually trigger the cron sweep ("Run sweep now"). ADMIN-GATED — gives staff
 * a trigger that doesn't depend on CRON_SECRET. Returns the per-workflow
 * scanned/dispatched/skipped summary so the console can show what happened.
 * The sweep itself still honors the global pause and per-workflow kill switches.
 */
export async function runSweepNow(): Promise<SweepActionResult> {
  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const result = await runAutomationSweep();

  revalidatePath(PAGE);
  return { ok: true, result };
}
