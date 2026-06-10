import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

// dispatch.ts builds its client via createSupabaseAdminClient(); point that at a
// per-test fake. The variable is reassigned in each test before the call.
let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));

import { executeApprovedRun } from "@/lib/automation/dispatch";
import { crossCheckArgs } from "@/lib/automation/registry";

// ---------------------------------------------------------------------------
// H3 — pure arg cross-check
// ---------------------------------------------------------------------------
describe("crossCheckArgs (H3)", () => {
  it("passes when args match the run's member + entity", () => {
    expect(crossCheckArgs({ memberId: "m1", ceuId: "c1" }, { memberId: "m1", entityId: "c1" })).toBeNull();
  });

  it("flags a member mismatch", () => {
    expect(crossCheckArgs({ memberId: "m2" }, { memberId: "m1", entityId: "c1" })).toBe("member_mismatch");
  });

  it("flags an entity mismatch (first present entity-id key is authoritative)", () => {
    expect(crossCheckArgs({ ceuId: "c2" }, { memberId: "m1", entityId: "c1" })).toBe("entity_mismatch");
    expect(crossCheckArgs({ applicationId: "a2" }, { entityId: "a1" })).toBe("entity_mismatch");
  });

  it("does not flag when a side is missing (nothing to contradict)", () => {
    expect(crossCheckArgs({ subject: "hi" }, { memberId: "m1", entityId: "c1" })).toBeNull();
    expect(crossCheckArgs({ memberId: "m1" }, { memberId: null, entityId: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// executeApprovedRun — H1 (atomic claim), H2 (kill switch), H3 (cross-check)
// ---------------------------------------------------------------------------

type RunRow = {
  id: string;
  status: string;
  workflow: string;
  entity_type: string;
  entity_id: string | null;
  member_id: string | null;
  staged_action: { handler: string; args: Record<string, unknown> } | null;
};

const baseRun: RunRow = {
  id: "run-1",
  status: "pending_approval",
  workflow: "ceu_review",
  entity_type: "ceu_record",
  entity_id: "c1",
  member_id: "m1",
  staged_action: { handler: "approve_ceu", args: { ceuId: "c1", memberId: "m1" } },
};

/**
 * Build a fake whose per-(table,op) results model a full approve flow:
 *  - automation_runs/select → the run row
 *  - automation_global/select → { paused }
 *  - automation_config/select → { enabled }
 *  - automation_runs/update → the CLAIM result ({ id } = claimed, null = lost)
 *  - ceu_records/select → executor's "before" row
 *  - ceu_records/update → executor write result
 */
function setup(opts: {
  run?: RunRow | null;
  paused?: boolean;
  enabled?: boolean;
  claim?: QueryResult; // result of the atomic claim update
  ceuBefore?: QueryResult;
}) {
  const resultFor = (table: string, op: Op): QueryResult => {
    if (table === "automation_runs" && op === "select") return { data: opts.run ?? null };
    if (table === "automation_global") return { data: { paused: opts.paused ?? false } };
    if (table === "automation_config")
      return { data: { enabled: opts.enabled ?? true, auto_threshold: null, propose_threshold: null } };
    if (table === "automation_runs" && op === "update") return opts.claim ?? { data: { id: "run-1" } };
    if (table === "ceu_records" && op === "select") return opts.ceuBefore ?? { data: { id: "c1", status: "pending" } };
    return { data: null };
  };
  active = makeClient({ id: "admin-1" }, resultFor);
}

describe("executeApprovedRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when the run is missing", async () => {
    setup({ run: null });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r).toEqual({ ok: false, error: "not_found" });
  });

  it("returns not_pending when the run is already resolved", async () => {
    setup({ run: { ...baseRun, status: "approved" } });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r).toEqual({ ok: false, error: "not_pending" });
  });

  it("H2 — refuses to fire while globally paused (no claim, no write)", async () => {
    setup({ run: baseRun, paused: true });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r).toEqual({ ok: false, error: "paused" });
    // Nothing should have been claimed or written.
    expect(active.callsFor("automation_runs", "update")).toHaveLength(0);
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
  });

  it("H2 — refuses to fire when the workflow was disabled after staging", async () => {
    setup({ run: baseRun, enabled: false });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r).toEqual({ ok: false, error: "disabled" });
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
  });

  it("H1 — loses the race when the claim affects no row (concurrent approval)", async () => {
    setup({ run: baseRun, claim: { data: null } });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r).toEqual({ ok: false, error: "already_claimed" });
    // Claim was attempted, but the executor never ran.
    const claim = active.callsFor("automation_runs", "update")[0];
    expect(claim.filters).toEqual(
      expect.arrayContaining([
        { col: "id", val: "run-1" },
        { col: "status", val: "pending_approval" },
      ]),
    );
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
  });

  it("H1 — claims with a pending_approval guard then executes (happy path)", async () => {
    setup({ run: baseRun });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r.ok).toBe(true);
    // The claim update is guarded on the prior status.
    const claim = active.callsFor("automation_runs", "update")[0];
    expect(claim.filters).toContainEqual({ col: "status", val: "pending_approval" });
    expect(claim.payload).toMatchObject({ status: "approving" });
    // Executor ran.
    expect(active.callsFor("ceu_records", "update")).toHaveLength(1);
  });

  it("H3 — rejects a staged action aimed at a different member (no executor write)", async () => {
    const run = { ...baseRun, staged_action: { handler: "approve_ceu", args: { ceuId: "c1", memberId: "OTHER" } } };
    setup({ run });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("arg_mismatch:member_mismatch");
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
    // The run is flipped to failed after the rejected action.
    const finalUpdate = active.callsFor("automation_runs", "update").at(-1);
    expect(finalUpdate?.payload).toMatchObject({ status: "failed" });
  });

  it("M1 — no-ops (still ok) when the entity already reached the target state", async () => {
    // approve_ceu where the record is ALREADY approved → idempotent success, no write.
    setup({ run: baseRun, ceuBefore: { data: { id: "c1", status: "approved" } } });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r.ok).toBe(true);
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
  });

  it("M1 — refuses when an expectStatus precondition no longer holds (state moved)", async () => {
    const run = {
      ...baseRun,
      staged_action: { handler: "approve_ceu", args: { ceuId: "c1", memberId: "m1", expectStatus: "pending" } },
    };
    setup({ run, ceuBefore: { data: { id: "c1", status: "rejected" } } });
    const r = await executeApprovedRun("run-1", "admin-1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("state_moved");
    expect(active.callsFor("ceu_records", "update")).toHaveLength(0);
  });
});
