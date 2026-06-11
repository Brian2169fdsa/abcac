import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor, type QueryResult } from "./helpers/supabase-fake";

// Admin automation-console server actions: every action must re-verify the
// caller's portal_role server-side, delegate execution to the engine's
// single dispatch path (executeApprovedRun / rejectRun), and never touch the
// engine for a non-admin caller.

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const revalidatePath = vi.fn();
const executeApprovedRun = vi.fn();
const rejectRun = vi.fn();
const runAutomationSweep = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/automation/dispatch", () => ({
  executeApprovedRun: (...a: unknown[]) => executeApprovedRun(...a),
  rejectRun: (...a: unknown[]) => rejectRun(...a),
}));
vi.mock("@/lib/automation/sweep", () => ({
  runAutomationSweep: (...a: unknown[]) => runAutomationSweep(...a),
}));

import {
  approveAutomationRun,
  rejectAutomationRun,
  resolveEscalatedRun,
  runSweepNow,
} from "@/app/(admin)/admin/automation/actions";

beforeEach(() => {
  revalidatePath.mockClear();
  executeApprovedRun.mockReset();
  rejectRun.mockReset();
  runAutomationSweep.mockReset();
});

/** Server client returns the caller's role; admin client uses adminResult. */
function setup(opts: {
  user: { id: string } | null;
  callerRole: string | null;
  adminResult?: ResultFor;
}) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  adminRef.current = makeClient(opts.user, opts.adminResult ?? (() => ({ data: null })));
}

describe("approveAutomationRun", () => {
  it("rejects a missing run id", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await approveAutomationRun("")).toEqual({ ok: false, error: "bad_request" });
    expect(executeApprovedRun).not.toHaveBeenCalled();
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await approveAutomationRun("run1")).toEqual({ ok: false, error: "unauthorized" });
    expect(executeApprovedRun).not.toHaveBeenCalled();
  });

  it("forbids a plain member caller and never touches the engine", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await approveAutomationRun("run1")).toEqual({ ok: false, error: "forbidden" });
    expect(executeApprovedRun).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: executes through dispatch with the approver id and revalidates", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    executeApprovedRun.mockResolvedValue({ ok: true });
    expect(await approveAutomationRun("run1")).toEqual({ ok: true });
    expect(executeApprovedRun).toHaveBeenCalledWith("run1", "admin1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automation");
  });

  it("superadmin may approve too (isAdminRole covers both tiers)", async () => {
    setup({ user: { id: "s1" }, callerRole: "superadmin" });
    executeApprovedRun.mockResolvedValue({ ok: true });
    expect(await approveAutomationRun("run1")).toEqual({ ok: true });
    expect(executeApprovedRun).toHaveBeenCalledWith("run1", "s1");
  });

  it("surfaces a dispatch failure without revalidating", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    executeApprovedRun.mockResolvedValue({ ok: false, error: "not_pending" });
    expect(await approveAutomationRun("run1")).toEqual({ ok: false, error: "not_pending" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rejectAutomationRun", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await rejectAutomationRun("run1")).toEqual({ ok: false, error: "forbidden" });
    expect(rejectRun).not.toHaveBeenCalled();
  });

  it("admin: rejects through dispatch with the approver id and revalidates", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    rejectRun.mockResolvedValue({ ok: true });
    expect(await rejectAutomationRun("run1")).toEqual({ ok: true });
    expect(rejectRun).toHaveBeenCalledWith("run1", "admin1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automation");
  });

  it("surfaces a reject failure", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    rejectRun.mockResolvedValue({ ok: false, error: "boom" });
    expect(await rejectAutomationRun("run1")).toEqual({ ok: false, error: "boom" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("resolveEscalatedRun", () => {
  it("rejects a missing run id", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await resolveEscalatedRun("")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await resolveEscalatedRun("run1")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller — no writes at all", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await resolveEscalatedRun("run1")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: marks the run rejected, guarded on status=escalated, audits, revalidates", async () => {
    setup({
      user: { id: "admin1" },
      callerRole: "admin",
      adminResult: (table, op) =>
        table === "automation_runs" && op === "update" ? { data: { id: "run1" } } : { data: null },
    });

    expect(await resolveEscalatedRun("run1")).toEqual({ ok: true });

    const upd = adminRef.current!.callsFor("automation_runs", "update")[0];
    expect(upd.payload).toMatchObject({ status: "rejected", resolved_by: "admin1" });
    expect(upd.filters).toContainEqual({ col: "id", val: "run1" });
    expect(upd.filters).toContainEqual({ col: "status", val: "escalated" });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "automation_escalation_dismissed",
      automation_run_id: "run1",
      actor_type: "human",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automation");
  });

  it("returns not_escalated when no escalated row matches (already resolved)", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await resolveEscalatedRun("run1")).toEqual({ ok: false, error: "not_escalated" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces an update error", async () => {
    setup({
      user: { id: "admin1" },
      callerRole: "admin",
      adminResult: (table, op): QueryResult =>
        table === "automation_runs" && op === "update"
          ? { error: { message: "db down" } }
          : { data: null },
    });
    expect(await resolveEscalatedRun("run1")).toEqual({ ok: false, error: "db down" });
  });
});

describe("runSweepNow", () => {
  it("returns unauthorized with no session and never sweeps", async () => {
    setup({ user: null, callerRole: null });
    expect(await runSweepNow()).toEqual({ ok: false, error: "unauthorized" });
    expect(runAutomationSweep).not.toHaveBeenCalled();
  });

  it("forbids a plain member caller and never sweeps", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await runSweepNow()).toEqual({ ok: false, error: "forbidden" });
    expect(runAutomationSweep).not.toHaveBeenCalled();
  });

  it("admin: runs the sweep and returns the per-workflow summary", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const summary = {
      ceu_review: { scanned: 3, dispatched: 2 },
      dunning: { skipped: "disabled" },
    };
    runAutomationSweep.mockResolvedValue(summary);

    expect(await runSweepNow()).toEqual({ ok: true, result: summary });
    expect(runAutomationSweep).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/automation");
  });

  it("passes through a paused sweep result untouched", async () => {
    setup({ user: { id: "s1" }, callerRole: "superadmin" });
    runAutomationSweep.mockResolvedValue({ paused: true });
    expect(await runSweepNow()).toEqual({ ok: true, result: { paused: true } });
  });
});
