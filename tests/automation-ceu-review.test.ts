import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));
// Stub dispatch so the sweep tests count hand-offs without running the engine.
const dispatchMock = vi.fn(async () => ({ status: "escalated" as const }));
vi.mock("@/lib/automation/dispatch", () => ({
  dispatch: (...a: unknown[]) => dispatchMock(...(a as [])),
}));

import { ceuReviewRule, CEU_REVIEW_RULE_VERSION } from "@/lib/automation/workflows/ceu-review";
import { sweepCeuReview, hasExistingRun, runAutomationSweep } from "@/lib/automation/sweep";

const INPUT = { workflow: "ceu_review", entityType: "ceu_record", entityId: "ceu-1" };

function ceuClient(rec: unknown): FakeClient {
  return makeClient({ id: "admin" }, (t: string): QueryResult =>
    t === "ceu_records" ? { data: rec } : { data: null },
  );
}

const future = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
const past = "2025-01-15";

// ── Rule ────────────────────────────────────────────────────────────────────
describe("ceuReviewRule", () => {
  it("returns null without an entityId / missing / already reviewed", async () => {
    expect(await ceuReviewRule(ceuClient(null).client, { ...INPUT, entityId: null })).toBeNull();
    expect(await ceuReviewRule(ceuClient(null).client, INPUT)).toBeNull();
    const approved = { id: "ceu-1", status: "approved", hours: 6, completion_date: past, course_name: "X" };
    expect(await ceuReviewRule(ceuClient(approved).client, INPUT)).toBeNull();
  });

  it("escalates clean submissions with no anomalies", async () => {
    const rec = { id: "ceu-1", status: "pending", hours: 6, completion_date: past, course_name: "Ethics" };
    const r = await ceuReviewRule(ceuClient(rec).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toEqual([]);
    expect(r?.ruleVersion).toBe(CEU_REVIEW_RULE_VERSION);
    expect(r?.summary).toMatch(/ready for reviewer/i);
  });

  it("flags a future-dated completion", async () => {
    const rec = { id: "ceu-1", status: "pending", hours: 3, completion_date: future, course_name: "Trauma" };
    const r = await ceuReviewRule(ceuClient(rec).client, INPUT);
    expect(r?.anomalies).toContain("future_dated");
  });

  it("flags implausible hours (zero, negative, or absurdly high)", async () => {
    for (const hours of [0, -2, 999]) {
      const rec = { id: "ceu-1", status: "pending", hours, completion_date: past, course_name: "C" };
      const r = await ceuReviewRule(ceuClient(rec).client, INPUT);
      expect(r?.anomalies).toContain("implausible_hours");
    }
  });

  it("accepts string hours within range without flagging", async () => {
    const rec = { id: "ceu-1", status: "pending", hours: "12.5", completion_date: past, course_name: "C" };
    const r = await ceuReviewRule(ceuClient(rec).client, INPUT);
    expect(r?.anomalies).toEqual([]);
  });
});

// ── Sweep ─────────────────────────────────────────────────────────────────────
describe("sweepCeuReview", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("dispatches each pending CEU with no existing run", async () => {
    active = makeClient({ id: "admin" }, (t: string, op: Op): QueryResult => {
      if (t === "ceu_records" && op === "select")
        return { data: [{ id: "c1", member_id: "m1", status: "pending" }, { id: "c2", member_id: "m2", status: "pending" }] };
      if (t === "automation_runs" && op === "select") return { data: null }; // no existing run
      return { data: null };
    });
    const res = await sweepCeuReview(active.client);
    expect(res).toEqual({ scanned: 2, dispatched: 2 });
    expect(dispatchMock).toHaveBeenCalledTimes(2);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "ceu_review", entityType: "ceu_record", entityId: "c1", memberId: "m1" }),
    );
  });

  it("skips CEUs that already have a run (idempotent)", async () => {
    active = makeClient({ id: "admin" }, (t: string, op: Op): QueryResult => {
      if (t === "ceu_records" && op === "select") return { data: [{ id: "c1", member_id: "m1", status: "pending" }] };
      if (t === "automation_runs" && op === "select") return { data: { id: "run-existing" } };
      return { data: null };
    });
    const res = await sweepCeuReview(active.client);
    expect(res).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("hasExistingRun filters on workflow + entity_id", async () => {
    active = makeClient({ id: "admin" }, () => ({ data: { id: "r" } }));
    const ok = await hasExistingRun(active.client, "ceu_review", "c9");
    expect(ok).toBe(true);
    const call = active.callsFor("automation_runs", "select")[0];
    expect(call.filters).toEqual(
      expect.arrayContaining([
        { col: "workflow", val: "ceu_review" },
        { col: "entity_id", val: "c9" },
      ]),
    );
  });
});

// ── runAutomationSweep gating ─────────────────────────────────────────────────
describe("runAutomationSweep", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("skips the scan when ceu_review is disabled", async () => {
    active = makeClient({ id: "admin" }, (t: string): QueryResult => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: false, auto_threshold: null, propose_threshold: null } };
      return { data: null };
    });
    const out = await runAutomationSweep();
    expect(out.ceu_review).toEqual({ skipped: "disabled" });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("returns paused without scanning when globally paused", async () => {
    active = makeClient({ id: "admin" }, (t: string): QueryResult =>
      t === "automation_global" ? { data: { paused: true } } : { data: null },
    );
    expect(await runAutomationSweep()).toEqual({ paused: true });
  });

  it("runs the CEU scan when enabled", async () => {
    active = makeClient({ id: "admin" }, (t: string, op: Op): QueryResult => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: true, auto_threshold: null, propose_threshold: null } };
      if (t === "ceu_records" && op === "select") return { data: [{ id: "c1", member_id: "m1", status: "pending" }] };
      if (t === "automation_runs" && op === "select") return { data: null };
      return { data: null };
    });
    const out = await runAutomationSweep();
    expect(out.ceu_review).toEqual({ scanned: 1, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
