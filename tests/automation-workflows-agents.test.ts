import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

/**
 * Tests for the first two MODEL-EVALUATED workflows (account_approval,
 * name_change): rule gating paths, executors (happy / idempotent /
 * state_moved), sweeps (dispatch + dedup), and the agent evaluators with the
 * model boundary fully mocked — `@anthropic-ai/sdk` is replaced with a fake
 * whose `messages.create` is queueable (same pattern as automation-vision),
 * so no real HTTP ever happens. Missing-key behavior (agent → null) is
 * exercised by deleting ANTHROPIC_API_KEY.
 */

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create };
  }
  return { default: Anthropic };
});

let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));
const dispatchMock = vi.fn(async () => ({ status: "auto_executed" as const }));
vi.mock("@/lib/automation/dispatch", () => ({
  dispatch: (...a: unknown[]) => dispatchMock(...(a as [])),
}));

import {
  accountApprovalRule,
  accountApprovalAgent,
  certNumberTokens,
  ACCOUNT_APPROVAL_MODEL_VERSION,
} from "@/lib/automation/workflows/account-approval";
import {
  nameChangeRule,
  nameChangeAgent,
  NAME_CHANGE_CONFIDENCE_CAP,
  NAME_CHANGE_MODEL_VERSION,
} from "@/lib/automation/workflows/name-change";
import { REGISTRY, parseFullName } from "@/lib/automation/registry";
import { sweepAccountApproval, sweepNameChange } from "@/lib/automation/sweep";

function client(map: (t: string, op: Op) => QueryResult): FakeClient {
  return makeClient({ id: "admin" }, map);
}

/** Build a fake Anthropic message response with a single text block. */
function textMsg(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

const PENDING_PROFILE = {
  id: "m1",
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone: "555-0100",
  date_of_birth: "1990-04-01",
  address_line1: "1 Main St",
  city: "Phoenix",
  state: "Arizona",
  zip_code: "85001",
  account_status: "pending",
  account_submitted_at: "2026-06-01T00:00:00Z",
  submitted_cert_numbers: null as string | null,
};

const PENDING_REQUEST = {
  id: "ncr-1",
  member_id: "m1",
  current_name: "Jane Doe",
  new_name: "Jane Smith",
  reason: "Marriage",
  doc_path: "name-change-docs/m1/cert.pdf",
  status: "pending",
};

beforeEach(() => {
  create.mockReset();
  dispatchMock.mockClear();
  delete process.env.ANTHROPIC_API_KEY;
});

// ── account_approval rule ─────────────────────────────────────────────────────
describe("accountApprovalRule", () => {
  const INPUT = { workflow: "account_approval", entityType: "profile", entityId: "m1", memberId: "m1" };

  it("returns null for missing / already-decided / not-yet-submitted profiles", async () => {
    expect(await accountApprovalRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await accountApprovalRule(
        client(() => ({ data: { ...PENDING_PROFILE, account_status: "approved" } })).client,
        INPUT,
      ),
    ).toBeNull();
    expect(
      await accountApprovalRule(
        client(() => ({ data: { ...PENDING_PROFILE, account_submitted_at: null } })).client,
        INPUT,
      ),
    ).toBeNull();
  });

  it("decisively escalates an incomplete profile (never auto-approves it)", async () => {
    const r = await accountApprovalRule(
      client(() => ({ data: { ...PENDING_PROFILE, date_of_birth: null, email: "  " } })).client,
      INPUT,
    );
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toEqual(["incomplete_profile"]);
    expect(r?.summary).toContain("email");
    expect(r?.summary).toContain("date_of_birth");
    expect(r?.action).toBeUndefined();
  });

  it("auto-approves when a self-reported cert number matches an ACTIVE cert", async () => {
    const c = client((t) => {
      if (t === "profiles") return { data: { ...PENDING_PROFILE, submitted_cert_numbers: "CAC-1234, 9999" } };
      if (t === "certifications") return { data: [{ id: "c1", cert_number: "CAC-1234", cert_type: "CAC", status: "active" }] };
      return { data: null };
    });
    const r = await accountApprovalRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.action?.handler).toBe("approve_account");
    expect(r?.action?.args).toMatchObject({ memberId: "m1", expectStatus: "pending" });
    expect(r?.summary).toContain("CAC-1234");
  });

  it("returns null (agent's turn) for a complete profile with no cert match", async () => {
    const c = client((t) => {
      if (t === "profiles") return { data: { ...PENDING_PROFILE, submitted_cert_numbers: "NOPE-1" } };
      if (t === "certifications") return { data: [] };
      return { data: null };
    });
    expect(await accountApprovalRule(c.client, INPUT)).toBeNull();
  });

  it("tokenizes free-text self-reported cert numbers", () => {
    expect(certNumberTokens("CAC-12, 4471; CADAC-9\n77")).toEqual(["CAC-12", "4471", "CADAC-9", "77"]);
    expect(certNumberTokens("")).toEqual([]);
    expect(certNumberTokens(null)).toEqual([]);
  });
});

// ── account_approval agent ────────────────────────────────────────────────────
describe("accountApprovalAgent", () => {
  const INPUT = { workflow: "account_approval", entityType: "profile", entityId: "m1", memberId: "m1" };
  const profileClient = () =>
    client((t) => {
      if (t === "profiles") return { data: { ...PENDING_PROFILE } };
      if (t === "certifications") return { data: [] };
      return { data: null };
    });

  it("returns null without an API key (dispatch escalates 'no_evaluator')", async () => {
    expect(await accountApprovalAgent(profileClient().client, INPUT)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("returns null for an already-decided profile (never re-evaluates)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const c = client((t) => (t === "profiles" ? { data: { ...PENDING_PROFILE, account_status: "rejected" } } : { data: null }));
    expect(await accountApprovalAgent(c.client, INPUT)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("maps an approve recommendation to the approve_account action", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(
      textMsg('```json\n{"recommend":"approve","confidence":0.96,"rationale":"Consistent registration."}\n```'),
    );
    const ev = await accountApprovalAgent(profileClient().client, INPUT);
    expect(ev?.confidence).toBe(0.96);
    expect(ev?.action).toEqual({
      handler: "approve_account",
      args: { memberId: "m1", expectStatus: "pending" },
    });
    expect(ev?.modelVersion).toBe(ACCOUNT_APPROVAL_MODEL_VERSION);
    expect(ev?.summary).toContain("Consistent");
    // Prompt carried the profile facts, not raw instructions from elsewhere.
    const sent = create.mock.calls[0][0];
    expect(String(sent.messages[0].content)).toContain("example.com");
  });

  it("ships no action when the model recommends escalate", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(textMsg('{"recommend":"escalate","confidence":0.9,"rationale":"Odd."}'));
    const ev = await accountApprovalAgent(profileClient().client, INPUT);
    expect(ev?.action).toBeUndefined();
    expect(ev?.anomalies).toEqual([]);
  });

  it("never carries an action for an unexpected recommendation (e.g. reject)", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(textMsg('{"recommend":"reject","confidence":0.99}'));
    const ev = await accountApprovalAgent(profileClient().client, INPUT);
    expect(ev?.action).toBeUndefined();
    expect(ev?.anomalies).toEqual(["unexpected_recommendation"]);
  });

  it("escalates via anomaly on malformed model JSON", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(textMsg("I think this looks fine!"));
    const ev = await accountApprovalAgent(profileClient().client, INPUT);
    expect(ev?.confidence).toBe(0);
    expect(ev?.anomalies).toEqual(["parse_error"]);
    expect(ev?.action).toBeUndefined();
  });

  it("escalates via anomaly when the model call throws", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockRejectedValueOnce(new Error("500"));
    const ev = await accountApprovalAgent(profileClient().client, INPUT);
    expect(ev?.anomalies).toEqual(["model_error"]);
    expect(ev?.confidence).toBe(0);
  });
});

// ── name_change rule ──────────────────────────────────────────────────────────
describe("nameChangeRule", () => {
  const INPUT = { workflow: "name_change", entityType: "name_change_request", entityId: "ncr-1", memberId: "m1" };

  it("returns null for missing / already-decided requests", async () => {
    expect(await nameChangeRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await nameChangeRule(client(() => ({ data: { ...PENDING_REQUEST, status: "completed" } })).client, INPUT),
    ).toBeNull();
  });

  it("escalates when the new name is empty or identical to the current name", async () => {
    const empty = await nameChangeRule(
      client(() => ({ data: { ...PENDING_REQUEST, new_name: "  " } })).client,
      INPUT,
    );
    expect(empty?.decisive).toBe(true);
    expect(empty?.tier).toBe("escalate");
    expect(empty?.anomalies).toEqual(["nothing_to_change"]);

    const same = await nameChangeRule(
      client(() => ({ data: { ...PENDING_REQUEST, new_name: "  jane   DOE " } })).client,
      INPUT,
    );
    expect(same?.anomalies).toEqual(["nothing_to_change"]);
  });

  it("escalates when there is no supporting document", async () => {
    const r = await nameChangeRule(
      client(() => ({ data: { ...PENDING_REQUEST, doc_path: null } })).client,
      INPUT,
    );
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toEqual(["no_supporting_document"]);
  });

  it("returns null (agent's turn) for a documented, real change", async () => {
    expect(await nameChangeRule(client(() => ({ data: { ...PENDING_REQUEST } })).client, INPUT)).toBeNull();
  });
});

// ── name_change agent ─────────────────────────────────────────────────────────
describe("nameChangeAgent", () => {
  const INPUT = { workflow: "name_change", entityType: "name_change_request", entityId: "ncr-1", memberId: "m1" };
  const reqClient = () => client((t) => (t === "name_change_requests" ? { data: { ...PENDING_REQUEST } } : { data: null }));

  it("returns null without an API key (dispatch escalates 'no_evaluator')", async () => {
    expect(await nameChangeAgent(reqClient().client, INPUT)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("maps apply to the apply_name_change action and CAPS confidence at 0.85", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(
      textMsg('{"recommend":"apply","confidence":0.99,"rationale":"Routine surname change after marriage."}'),
    );
    const ev = await nameChangeAgent(reqClient().client, INPUT);
    // Doc not visually verified → can never clear the 0.90 auto threshold.
    expect(ev?.confidence).toBe(NAME_CHANGE_CONFIDENCE_CAP);
    expect(ev?.action).toEqual({
      handler: "apply_name_change",
      args: { id: "ncr-1", memberId: "m1", expectStatus: "pending" },
    });
    expect(ev?.modelVersion).toBe(NAME_CHANGE_MODEL_VERSION);
    const prompt = String(create.mock.calls[0][0].messages[0].content);
    expect(prompt).toContain("Jane Doe");
    expect(prompt).toContain("Jane Smith");
    expect(prompt).toContain("Marriage");
  });

  it("keeps a sub-cap confidence as-is", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(textMsg('{"recommend":"apply","confidence":0.6,"rationale":"ok"}'));
    const ev = await nameChangeAgent(reqClient().client, INPUT);
    expect(ev?.confidence).toBe(0.6);
  });

  it("ships no action when the model recommends escalate", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(
      textMsg('{"recommend":"escalate","confidence":0.8,"rationale":"Complete identity swap."}'),
    );
    const ev = await nameChangeAgent(reqClient().client, INPUT);
    expect(ev?.action).toBeUndefined();
    expect(ev?.summary).toContain("identity swap");
  });

  it("escalates via anomaly on malformed model JSON", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    create.mockResolvedValueOnce(textMsg("no json"));
    const ev = await nameChangeAgent(reqClient().client, INPUT);
    expect(ev?.anomalies).toEqual(["parse_error"]);
    expect(ev?.confidence).toBe(0);
    expect(ev?.action).toBeUndefined();
  });
});

// ── approve_account executor ──────────────────────────────────────────────────
describe("approve_account executor", () => {
  it("rejects missing args and unknown profiles", async () => {
    expect((await REGISTRY.approve_account(client(() => ({ data: null })).client, {})).error).toBe("bad_args");
    const res = await REGISTRY.approve_account(client(() => ({ data: null })).client, { memberId: "m1" });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
  });

  it("approves a pending account and stamps account_reviewed_at", async () => {
    const c = client((t, op) => {
      if (t === "profiles" && op === "select") return { data: { id: "m1", account_status: "pending" } };
      return { data: null };
    });
    const res = await REGISTRY.approve_account(c.client, { memberId: "m1" });
    expect(res.ok).toBe(true);
    expect(res.after).toEqual({ id: "m1", account_status: "approved" });
    const upd = c.callsFor("profiles", "update")[0];
    expect(upd.payload).toMatchObject({ account_status: "approved" });
    expect((upd.payload as Record<string, unknown>).account_reviewed_at).toBeTruthy();
    // Race guard: the update is keyed on the still-pending status.
    expect(upd.filters).toEqual([
      { col: "id", val: "m1" },
      { col: "account_status", val: "pending" },
    ]);
  });

  it("is idempotent for an already-approved account (no write)", async () => {
    const c = client((t, op) =>
      t === "profiles" && op === "select" ? { data: { id: "m1", account_status: "approved" } } : { data: null },
    );
    const res = await REGISTRY.approve_account(c.client, { memberId: "m1" });
    expect(res.ok).toBe(true);
    expect(c.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("refuses with state_moved when a human rejected the account", async () => {
    const c = client((t, op) =>
      t === "profiles" && op === "select" ? { data: { id: "m1", account_status: "rejected" } } : { data: null },
    );
    const res = await REGISTRY.approve_account(c.client, { memberId: "m1" });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("profiles", "update")).toHaveLength(0);
  });
});

// ── apply_name_change executor ────────────────────────────────────────────────
describe("apply_name_change executor", () => {
  it("rejects missing args and unknown requests", async () => {
    expect((await REGISTRY.apply_name_change(client(() => ({ data: null })).client, {})).error).toBe("bad_args");
    const res = await REGISTRY.apply_name_change(client(() => ({ data: null })).client, { id: "ncr-1" });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
  });

  it("completes the request and writes the parsed name to the profile", async () => {
    const c = client((t, op) => {
      if (t === "name_change_requests" && op === "select")
        return { data: { id: "ncr-1", member_id: "m1", new_name: "Jane Q Smith", status: "pending" } };
      if (t === "profiles" && op === "select")
        return { data: { id: "m1", first_name: "Jane", middle_name: null, last_name: "Doe" } };
      return { data: null };
    });
    const res = await REGISTRY.apply_name_change(c.client, { id: "ncr-1", memberId: "m1" });
    expect(res.ok).toBe(true);

    const reqUpd = c.callsFor("name_change_requests", "update")[0];
    expect(reqUpd.payload).toMatchObject({ status: "completed" });
    expect((reqUpd.payload as Record<string, unknown>).reviewed_at).toBeTruthy();
    expect(reqUpd.filters).toEqual([
      { col: "id", val: "ncr-1" },
      { col: "status", val: "pending" },
    ]);

    // 3+ parts → middle name captured; split on the LAST space for the surname.
    const profUpd = c.callsFor("profiles", "update")[0];
    expect(profUpd.payload).toEqual({ first_name: "Jane", middle_name: "Q", last_name: "Smith" });
    expect(profUpd.filters).toEqual([{ col: "id", val: "m1" }]);

    expect(res.before).toMatchObject({ profile: { first_name: "Jane", last_name: "Doe" } });
    expect(res.after).toMatchObject({
      request: { id: "ncr-1", status: "completed" },
      profile: { first_name: "Jane", middle_name: "Q", last_name: "Smith" },
    });
  });

  it("clears middle_name on a two-part name", async () => {
    const c = client((t, op) => {
      if (t === "name_change_requests" && op === "select")
        return { data: { id: "ncr-1", member_id: "m1", new_name: "Jane Smith", status: "pending" } };
      if (t === "profiles" && op === "select")
        return { data: { id: "m1", first_name: "Jane", middle_name: "Q", last_name: "Doe" } };
      return { data: null };
    });
    await REGISTRY.apply_name_change(c.client, { id: "ncr-1" });
    expect(c.callsFor("profiles", "update")[0].payload).toEqual({
      first_name: "Jane",
      middle_name: null,
      last_name: "Smith",
    });
  });

  it("is idempotent for an already-completed request (no writes)", async () => {
    const c = client((t, op) =>
      t === "name_change_requests" && op === "select"
        ? { data: { id: "ncr-1", member_id: "m1", new_name: "Jane Smith", status: "completed" } }
        : { data: null },
    );
    const res = await REGISTRY.apply_name_change(c.client, { id: "ncr-1" });
    expect(res.ok).toBe(true);
    expect(c.callsFor("name_change_requests", "update")).toHaveLength(0);
    expect(c.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("refuses with state_moved when a human already rejected the request", async () => {
    const c = client((t, op) =>
      t === "name_change_requests" && op === "select"
        ? { data: { id: "ncr-1", member_id: "m1", new_name: "Jane Smith", status: "rejected" } }
        : { data: null },
    );
    const res = await REGISTRY.apply_name_change(c.client, { id: "ncr-1" });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("parseFullName splits on the last space and keeps middles together", () => {
    expect(parseFullName("Jane Smith")).toEqual({ first: "Jane", middle: null, last: "Smith" });
    expect(parseFullName("Jane Q Smith")).toEqual({ first: "Jane", middle: "Q", last: "Smith" });
    expect(parseFullName("Jane Anne Marie Smith")).toEqual({ first: "Jane", middle: "Anne Marie", last: "Smith" });
    expect(parseFullName("  Cher  ")).toEqual({ first: "Cher", middle: null, last: "" });
  });
});

// ── sweeps ────────────────────────────────────────────────────────────────────
describe("sweeps", () => {
  it("sweepAccountApproval dispatches submitted pending profiles only", async () => {
    active = client((t, op) => {
      if (t === "profiles" && op === "select")
        return {
          data: [
            { id: "m1", account_submitted_at: "2026-06-01T00:00:00Z" },
            { id: "m2", account_submitted_at: null }, // signed up, never onboarded
          ],
        };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepAccountApproval(active.client)).toEqual({ scanned: 2, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "account_approval", entityType: "profile", entityId: "m1", memberId: "m1" }),
    );
  });

  it("sweepAccountApproval dedups against an existing run", async () => {
    active = client((t) => {
      if (t === "profiles") return { data: [{ id: "m1", account_submitted_at: "2026-06-01T00:00:00Z" }] };
      if (t === "automation_runs") return { data: { id: "run-1" } }; // already processed
      return { data: null };
    });
    expect(await sweepAccountApproval(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("sweepNameChange dispatches pending requests without an existing run", async () => {
    active = client((t) => {
      if (t === "name_change_requests") return { data: [{ id: "ncr-1", member_id: "m1" }, { id: "ncr-2", member_id: "m2" }] };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepNameChange(active.client)).toEqual({ scanned: 2, dispatched: 2 });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "name_change", entityType: "name_change_request", entityId: "ncr-1", memberId: "m1" }),
    );
  });

  it("sweepNameChange dedups against an existing run", async () => {
    active = client((t) => {
      if (t === "name_change_requests") return { data: [{ id: "ncr-1", member_id: "m1" }] };
      if (t === "automation_runs") return { data: { id: "run-9" } };
      return { data: null };
    });
    expect(await sweepNameChange(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
