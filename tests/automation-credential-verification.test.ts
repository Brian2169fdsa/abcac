import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

// dispatch()/executors build their client via createSupabaseAdminClient().
let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));

import { credentialVerificationRule } from "@/lib/automation/workflows/credential-verification";
import { REGISTRY } from "@/lib/automation/registry";
import { getRule } from "@/lib/automation/registrar";
import { registerWorkflows } from "@/lib/automation/workflows";
import { dispatch } from "@/lib/automation/dispatch";

const INPUT = { workflow: "credential_verification", entityType: "verification_request", entityId: "ver-1" };

function ruleClient(req: unknown, certs: unknown[]): FakeClient {
  return makeClient({ id: "admin" }, (t: string, op: Op): QueryResult => {
    if (t === "verification_requests" && op === "select") return { data: req };
    if (t === "certifications") return { data: certs };
    return { data: null };
  });
}

const activeCert = { id: "c1", member_id: "m1", cert_type: "LISAC", cert_number: "AZ-123", status: "active" };

// ── Rule ────────────────────────────────────────────────────────────────────
describe("credentialVerificationRule", () => {
  it("returns null without an entityId", async () => {
    const c = ruleClient(null, []);
    expect(await credentialVerificationRule(c.client, { ...INPUT, entityId: null })).toBeNull();
  });

  it("returns null when the request is missing or already decided", async () => {
    expect(await credentialVerificationRule(ruleClient(null, []).client, INPUT)).toBeNull();
    const decided = { id: "ver-1", status: "completed", subject_name: "X", subject_cert_number: "AZ-123" };
    expect(await credentialVerificationRule(ruleClient(decided, [activeCert]).client, INPUT)).toBeNull();
  });

  it("escalates when no cert number was provided", async () => {
    const req = { id: "ver-1", status: "pending", subject_name: "Jane Doe", subject_cert_number: null };
    const r = await credentialVerificationRule(ruleClient(req, []).client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toContain("no_cert_number");
  });

  it("AUTO-verifies a single clean active match", async () => {
    const req = { id: "ver-1", status: "pending", subject_name: "Maria", subject_cert_number: "AZ-123" };
    const r = await credentialVerificationRule(ruleClient(req, [activeCert]).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.action).toEqual({
      handler: "set_verification_result",
      args: { id: "ver-1", result: "verified", memberId: "m1" },
    });
  });

  it("escalates (never auto-denies) when there is no active match", async () => {
    const req = { id: "ver-1", status: "pending", subject_name: "Ghost", subject_cert_number: "AZ-999" };
    const r = await credentialVerificationRule(ruleClient(req, []).client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toContain("no_active_match");
    expect(r?.action).toBeUndefined();
  });

  it("escalates on multiple active matches (ambiguous)", async () => {
    const req = { id: "ver-1", status: "pending", subject_name: "Dup", subject_cert_number: "AZ-123" };
    const certs = [activeCert, { ...activeCert, id: "c2" }];
    const r = await credentialVerificationRule(ruleClient(req, certs).client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toContain("multiple_active_matches");
  });

  it("ignores non-active certs sharing the number (lapsed → escalate)", async () => {
    const req = { id: "ver-1", status: "pending", subject_name: "Old", subject_cert_number: "AZ-123" };
    const r = await credentialVerificationRule(ruleClient(req, [{ ...activeCert, status: "lapsed" }]).client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toContain("no_active_match");
  });
});

// ── Executor ──────────────────────────────────────────────────────────────────
describe("set_verification_result executor", () => {
  it("rejects bad args", async () => {
    const c = makeClient({ id: "a" });
    expect(await REGISTRY.set_verification_result(c.client, {})).toMatchObject({ ok: false, error: "bad_args" });
    expect(await REGISTRY.set_verification_result(c.client, { id: "v", result: "maybe" })).toMatchObject({ ok: false, error: "bad_args" });
  });

  it("returns not_found when the request is gone", async () => {
    const c = makeClient({ id: "a" }, () => ({ data: null }));
    expect(await REGISTRY.set_verification_result(c.client, { id: "v", result: "verified" })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("refuses (state_moved) when the request is no longer pending", async () => {
    const c = makeClient({ id: "a" }, (t, op) =>
      t === "verification_requests" && op === "select" ? { data: { id: "v", status: "completed" } } : { data: null },
    );
    const r = await REGISTRY.set_verification_result(c.client, { id: "v", result: "verified" });
    expect(r).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("verification_requests", "update")).toHaveLength(0);
  });

  it("writes the decision when pending, guarding the update on status=pending", async () => {
    const c = makeClient({ id: "a" }, (t, op) => {
      if (t === "verification_requests" && op === "select") return { data: { id: "v", status: "pending" } };
      if (t === "verification_requests" && op === "update") return { data: { requester_email: null } };
      return { data: null };
    });
    const r = await REGISTRY.set_verification_result(c.client, { id: "v", result: "verified" });
    expect(r.ok).toBe(true);
    const upd = c.callsFor("verification_requests", "update")[0];
    expect(upd.payload).toMatchObject({ verification_result: "verified", status: "completed" });
    expect(upd.filters).toContainEqual({ col: "status", val: "pending" });
  });
});

// ── Registration ──────────────────────────────────────────────────────────────
describe("workflow registration", () => {
  it("registers credential_verification", () => {
    registerWorkflows();
    expect(typeof getRule("credential_verification")).toBe("function");
  });
});

// ── Dispatch integration ──────────────────────────────────────────────────────
describe("dispatch(credential_verification)", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup(opts: { paused?: boolean; enabled?: boolean }) {
    active = makeClient({ id: "admin" }, (t: string, op: Op): QueryResult => {
      if (t === "automation_global") return { data: { paused: opts.paused ?? false } };
      if (t === "automation_config") return { data: { enabled: opts.enabled ?? true, auto_threshold: null, propose_threshold: null } };
      if (t === "verification_requests" && op === "select") return { data: { id: "ver-1", status: "pending", subject_name: "Maria", subject_cert_number: "AZ-123" } };
      if (t === "certifications") return { data: [activeCert] };
      if (t === "automation_runs" && op === "insert") return { data: { id: "run-1" } };
      if (t === "verification_requests" && op === "update") return { data: { requester_email: null } };
      return { data: null };
    });
  }

  it("auto-executes a clean match end to end", async () => {
    setup({ enabled: true });
    const out = await dispatch(INPUT);
    expect(out.status).toBe("auto_executed");
    expect(out.tier).toBe("auto");
    // The whitelisted executor actually wrote the decision.
    expect(active.callsFor("verification_requests", "update")).toHaveLength(1);
    // And an automation_runs row was recorded.
    expect(active.callsFor("automation_runs", "insert")).toHaveLength(1);
  });

  it("does nothing when the workflow is disabled (ships off)", async () => {
    setup({ enabled: false });
    const out = await dispatch(INPUT);
    expect(out.status).toBe("skipped_disabled");
    expect(active.callsFor("verification_requests", "update")).toHaveLength(0);
  });

  it("does nothing while globally paused", async () => {
    setup({ enabled: true, paused: true });
    const out = await dispatch(INPUT);
    expect(out.status).toBe("skipped_paused");
    expect(active.callsFor("verification_requests", "update")).toHaveLength(0);
  });
});
