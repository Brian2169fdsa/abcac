// ABCAC — automation decision engine (dispatcher).
//
//   trigger → [global pause? workflow enabled?] → deterministic rule pass
//           → (ambiguous) agent eval → tier → AUTO-EXECUTE | PROPOSE | ESCALATE
//
// Every evaluation is recorded in automation_runs; every execution also writes an
// admin_audit_log row (actor_type system|agent, with rule_version or confidence/
// model_version). Auto/propose actions run ONLY through the registry whitelist.
//
// Ships inert: with every workflow `enabled = false` (migration 031), dispatch()
// records a skip and does nothing. Rule/agent evaluators are registered by their
// own modules via registerRule/registerAgent as each workflow is built.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isGloballyPaused, getWorkflowConfig, assertRunnable } from "./config";
import { tierFor } from "./tier";
import { REGISTRY, isWhitelisted, crossCheckArgs, type ExecResult, type RunContext } from "./registry";
import { getRule, getAgent, registerRule, registerAgent, type RuleFn, type AgentFn } from "./registrar";
import { registerWorkflows } from "./workflows";
import type { DispatchInput, DispatchOutcome, StagedAction } from "./types";

// Re-export the registrar surface so existing importers keep working.
export { registerRule, registerAgent };
export type { RuleFn, AgentFn };

async function insertRun(
  admin: SupabaseClient,
  input: DispatchInput,
  fields: Record<string, unknown>,
): Promise<string | undefined> {
  const { data } = await admin
    .from("automation_runs")
    .insert({
      workflow: input.workflow,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      member_id: input.memberId ?? null,
      ...fields,
    })
    .select("id")
    .maybeSingle();
  return (data as { id?: string } | null)?.id;
}

async function audit(
  admin: SupabaseClient,
  run: { id?: string; input: DispatchInput },
  actorType: "system" | "agent",
  action: StagedAction,
  result: ExecResult,
  meta: { ruleVersion?: string; confidence?: number; modelVersion?: string; tier: string },
): Promise<void> {
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: null,
      action: `auto:${action.handler}`,
      target_table: run.input.entityType,
      target_id: run.input.entityId ?? null,
      details: { workflow: run.input.workflow, args: action.args, ok: result.ok, error: result.error },
      actor_type: actorType,
      decision_tier: meta.tier,
      confidence: meta.confidence ?? null,
      rule_version: meta.ruleVersion ?? null,
      model_version: meta.modelVersion ?? null,
      automation_run_id: run.id ?? null,
      payload_before: result.before ?? null,
      payload_after: result.after ?? null,
    });
  } catch {
    /* best-effort */
  }
}

async function runAction(
  admin: SupabaseClient,
  action: StagedAction,
  ctx?: RunContext,
): Promise<ExecResult> {
  if (!isWhitelisted(action.handler)) return { ok: false, error: `handler_not_whitelisted:${action.handler}` };
  // H3 — a whitelisted write must target the SAME member/entity the run is about.
  if (ctx) {
    const mismatch = crossCheckArgs(action.args, ctx);
    if (mismatch) return { ok: false, error: `arg_mismatch:${mismatch}` };
  }
  return REGISTRY[action.handler](admin, action.args);
}

/** Evaluate one entity and auto-execute / stage / escalate per its workflow config. */
export async function dispatch(input: DispatchInput): Promise<DispatchOutcome> {
  registerWorkflows();
  const admin = createSupabaseAdminClient();

  if (await isGloballyPaused(admin)) return { status: "skipped_paused" };
  const cfg = await getWorkflowConfig(admin, input.workflow);
  if (!cfg || !cfg.enabled) return { status: "skipped_disabled" };

  // 1. Deterministic rule pass.
  const ruleFn = getRule(input.workflow);
  const rule = ruleFn ? await ruleFn(admin, input) : null;
  if (rule?.decisive) {
    const tier = rule.tier ?? "auto";
    if (tier === "auto" && rule.action) {
      const runId = await insertRun(admin, input, {
        tier: "auto",
        rule_version: rule.ruleVersion,
        staged_action: rule.action,
        anomaly_flags: rule.anomalies ?? [],
        summary: rule.summary ?? null,
        status: "auto_executed",
        resolved_at: new Date().toISOString(),
      });
      const result = await runAction(admin, rule.action, {
        memberId: input.memberId,
        entityId: input.entityId,
      });
      await audit(admin, { id: runId, input }, "system", rule.action, result, {
        ruleVersion: rule.ruleVersion,
        tier: "auto",
      });
      if (!result.ok) await admin.from("automation_runs").update({ status: "failed" }).eq("id", runId);
      return { status: result.ok ? "auto_executed" : "failed", runId, tier: "auto", error: result.error };
    }
    // Rule decisively wants a human (e.g. reciprocity always escalates).
    const runId = await insertRun(admin, input, {
      tier: "escalate",
      rule_version: rule.ruleVersion,
      staged_action: rule.action ?? null,
      anomaly_flags: rule.anomalies ?? [],
      summary: rule.summary ?? null,
      status: "escalated",
    });
    return { status: "escalated", runId, tier: "escalate" };
  }

  // 2. Agent evaluation (parse / read / match).
  const agentFn = getAgent(input.workflow);
  const ev = agentFn ? await agentFn(admin, input) : null;
  if (!ev) {
    const runId = await insertRun(admin, input, {
      tier: "escalate",
      anomaly_flags: ["no_evaluator"],
      summary: "No deterministic rule or agent evaluator available.",
      status: "escalated",
    });
    return { status: "escalated", runId, tier: "escalate" };
  }

  const tier = tierFor(ev.confidence, ev.anomalies ?? [], cfg);
  if (tier === "auto" && ev.action) {
    const runId = await insertRun(admin, input, {
      tier,
      confidence: ev.confidence,
      model_version: ev.modelVersion,
      staged_action: ev.action,
      anomaly_flags: ev.anomalies ?? [],
      summary: ev.summary ?? null,
      status: "auto_executed",
      resolved_at: new Date().toISOString(),
    });
    const result = await runAction(admin, ev.action, {
      memberId: input.memberId,
      entityId: input.entityId,
    });
    await audit(admin, { id: runId, input }, "agent", ev.action, result, {
      confidence: ev.confidence,
      modelVersion: ev.modelVersion,
      tier,
    });
    if (!result.ok) await admin.from("automation_runs").update({ status: "failed" }).eq("id", runId);
    return { status: result.ok ? "auto_executed" : "failed", runId, tier, error: result.error };
  }

  if (tier === "propose" && ev.action) {
    const runId = await insertRun(admin, input, {
      tier,
      confidence: ev.confidence,
      model_version: ev.modelVersion,
      staged_action: ev.action,
      anomaly_flags: ev.anomalies ?? [],
      summary: ev.summary ?? null,
      status: "pending_approval",
    });
    return { status: "pending_approval", runId, tier };
  }

  const runId = await insertRun(admin, input, {
    tier: "escalate",
    confidence: ev.confidence,
    model_version: ev.modelVersion,
    anomaly_flags: ev.anomalies ?? [],
    summary: ev.summary ?? null,
    status: "escalated",
  });
  return { status: "escalated", runId, tier: "escalate" };
}

/**
 * Execute a proposal a human approved in the Needs-Attention queue. Runs the
 * staged action through the registry and records the approver on both the run
 * and the audit row. Caller MUST verify the approver is an admin first.
 */
export async function executeApprovedRun(
  runId: string,
  approverId: string,
): Promise<{ ok: boolean; error?: string }> {
  registerWorkflows();
  const admin = createSupabaseAdminClient();
  const { data: run } = await admin
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, error: "not_found" };
  const r = run as {
    status: string;
    staged_action: StagedAction | null;
    workflow: string;
    entity_type: string;
    entity_id: string | null;
    member_id: string | null;
  };
  if (r.status !== "pending_approval") return { ok: false, error: "not_pending" };
  if (!r.staged_action) return { ok: false, error: "no_staged_action" };

  // H2 — the kill switch covers the approve path: a proposal staged before a
  // global pause or before its workflow was disabled must NOT fire on approval.
  const runnable = await assertRunnable(admin, r.workflow);
  if (!runnable.ok) return { ok: false, error: runnable.reason };

  // H1 — atomically CLAIM the row before doing any work. The update only
  // affects a row still in `pending_approval`, so two concurrent approvals
  // (double-click, two admins) cannot both pass and double-execute the staged
  // write. If the claim affects no row, someone else already took it.
  const { data: claimed } = await admin
    .from("automation_runs")
    .update({ status: "approving", resolved_by: approverId })
    .eq("id", runId)
    .eq("status", "pending_approval")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "already_claimed" };

  // H3 — the staged write must target the run's own member/entity.
  const result = await runAction(admin, r.staged_action, {
    memberId: r.member_id,
    entityId: r.entity_id,
  });
  await admin
    .from("automation_runs")
    .update({ status: result.ok ? "approved" : "failed", resolved_at: new Date().toISOString(), resolved_by: approverId })
    .eq("id", runId);
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: approverId,
      action: `auto_approved:${r.staged_action.handler}`,
      target_table: r.entity_type,
      target_id: r.entity_id,
      details: { workflow: r.workflow, args: r.staged_action.args, ok: result.ok, error: result.error },
      actor_type: "human",
      decision_tier: "propose",
      automation_run_id: runId,
      approved_by: approverId,
      payload_before: result.before ?? null,
      payload_after: result.after ?? null,
    });
  } catch {
    /* best-effort */
  }
  return { ok: result.ok, error: result.error };
}

/** Reject a pending proposal (no action runs). Caller must verify admin. */
export async function rejectRun(runId: string, approverId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_runs")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: approverId })
    .eq("id", runId)
    .eq("status", "pending_approval");
  return { ok: !error, error: error?.message };
}
