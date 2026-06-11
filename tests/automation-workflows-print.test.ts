// print_request — the last deterministic workflow: a paid payments row for the
// $25 printed-certificate product opens the staff fulfillment task
// ("Mail printed certificate") via the marker-idempotent create_print_task
// executor. Covers the rule, the executor, and the sweep.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));
const dispatchMock = vi.fn(async () => ({ status: "auto_executed" as const }));
vi.mock("@/lib/automation/dispatch", () => ({
  dispatch: (...a: unknown[]) => dispatchMock(...(a as [])),
}));

import {
  printRequestRule,
  printTaskMarker,
  isPrintProduct,
  PRINT_REQUEST_RULE_VERSION,
  PRINT_PRODUCT_SLUG,
} from "@/lib/automation/workflows/print-request";
import { REGISTRY, crossCheckArgs } from "@/lib/automation/registry";
import { sweepPrintRequest, runAutomationSweep } from "@/lib/automation/sweep";

function client(map: (t: string, op: Op) => QueryResult): FakeClient {
  return makeClient({ id: "admin" }, map);
}

const PAYMENT = {
  id: "pay-1",
  member_id: "m1",
  slug: PRINT_PRODUCT_SLUG,
  product_name: "Printed Certificate Copy",
  status: "paid",
  amount_cents: 2500,
};
const CERTS = [
  { id: "c-1", cert_type: "CAC", cert_number: "AZ-1001", status: "active", expiration_date: "2027-01-31" },
];
const MARKER = printTaskMarker("pay-1");

function ruleClient(opts: {
  payment?: Record<string, unknown> | null;
  certs?: Record<string, unknown>[];
  existingTask?: Record<string, unknown> | null;
}): FakeClient {
  return client((t) => {
    if (t === "payments") return { data: opts.payment ?? null };
    if (t === "certifications") return { data: opts.certs ?? [] };
    if (t === "member_tasks") return { data: opts.existingTask ?? null };
    return { data: null };
  });
}

// ── print_request rule ────────────────────────────────────────────────────────
describe("printRequestRule", () => {
  const INPUT = { workflow: "print_request", entityType: "payment", entityId: "pay-1" };

  it("matches the catalog slug, and the product name defensively", () => {
    expect(isPrintProduct(PRINT_PRODUCT_SLUG, null)).toBe(true);
    expect(isPrintProduct("", "Printed Certificate Copy")).toBe(true);
    expect(isPrintProduct("certification-sync", "Certification Sync")).toBe(false);
    expect(isPrintProduct(null, null)).toBe(false);
  });

  it("returns null for missing / memberless / unpaid / wrong-product payments", async () => {
    expect(await printRequestRule(ruleClient({ payment: null }).client, INPUT)).toBeNull();
    expect(await printRequestRule(ruleClient({ payment: { ...PAYMENT, member_id: null } }).client, INPUT)).toBeNull();
    expect(await printRequestRule(ruleClient({ payment: { ...PAYMENT, status: "refunded" } }).client, INPUT)).toBeNull();
    expect(
      await printRequestRule(
        ruleClient({ payment: { ...PAYMENT, slug: "certification-sync", product_name: "Certification Sync" } }).client,
        INPUT,
      ),
    ).toBeNull();
    expect(await printRequestRule(ruleClient({ payment: PAYMENT }).client, { ...INPUT, entityId: undefined })).toBeNull();
  });

  it("decisively escalates when the member has no certification (nothing to print)", async () => {
    const c = ruleClient({ payment: PAYMENT, certs: [] });
    const r = await printRequestRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("no_certification_to_print");
    expect(String(r?.summary)).toContain("nothing to print");
    expect(r?.ruleVersion).toBe(PRINT_REQUEST_RULE_VERSION);
    // escalated before ever touching member_tasks
    expect(c.callsFor("member_tasks")).toHaveLength(0);
  });

  it("returns null (already handled) when a task already carries the payment marker", async () => {
    const c = ruleClient({ payment: PAYMENT, certs: CERTS, existingTask: { id: "task-1" } });
    expect(await printRequestRule(c.client, INPUT)).toBeNull();
    // the dedup lookup is member-scoped and matches on the stable marker
    const lookup = c.callsFor("member_tasks", "select")[0];
    expect(lookup.filters).toContainEqual({ col: "member_id", val: "m1" });
    expect(lookup.filters).toContainEqual({ col: "detail", val: `%${MARKER}%` });
  });

  it("happy path: stages create_print_task (auto) targeting this payment and member", async () => {
    const r = await printRequestRule(ruleClient({ payment: PAYMENT, certs: CERTS }).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.ruleVersion).toBe(PRINT_REQUEST_RULE_VERSION);
    expect(r?.action?.handler).toBe("create_print_task");
    expect(r?.action?.args).toMatchObject({ paymentId: "pay-1", memberId: "m1" });
    expect(String(r?.summary)).toContain("Mail printed certificate");
    // H3 — the staged args pass the registry cross-check for this run's context
    expect(crossCheckArgs(r!.action!.args, { memberId: "m1", entityId: "pay-1" })).toBeNull();
    expect(crossCheckArgs(r!.action!.args, { memberId: "m2", entityId: "pay-1" })).toBe("member_mismatch");
    expect(crossCheckArgs(r!.action!.args, { memberId: "m1", entityId: "pay-2" })).toBe("entity_mismatch");
  });
});

// ── create_print_task executor ────────────────────────────────────────────────
describe("create_print_task executor", () => {
  function execClient(opts: {
    payment?: Record<string, unknown> | null;
    certs?: Record<string, unknown>[];
    existingTask?: Record<string, unknown> | null;
    insertedTask?: Record<string, unknown> | null;
  }): FakeClient {
    return client((t, op) => {
      if (t === "payments") return { data: opts.payment ?? null };
      if (t === "certifications") return { data: opts.certs ?? [] };
      if (t === "member_tasks" && op === "select") return { data: opts.existingTask ?? null };
      if (t === "member_tasks" && op === "insert") return { data: opts.insertedTask ?? { id: "task-9" } };
      return { data: null };
    });
  }

  it("rejects missing id, unknown payment, wrong product, and memberless payments", async () => {
    expect((await REGISTRY.create_print_task(execClient({}).client, {})).error).toBe("bad_args");
    expect(await REGISTRY.create_print_task(execClient({ payment: null }).client, { paymentId: "pay-x" })).toMatchObject({
      ok: false,
      error: "not_found",
    });
    expect(
      await REGISTRY.create_print_task(
        execClient({ payment: { ...PAYMENT, slug: "certification-sync", product_name: "Certification Sync" } }).client,
        { paymentId: "pay-1" },
      ),
    ).toMatchObject({ ok: false, error: "bad_state" });
    expect(
      await REGISTRY.create_print_task(execClient({ payment: { ...PAYMENT, member_id: null } }).client, { paymentId: "pay-1" }),
    ).toMatchObject({ ok: false, error: "bad_state" });
  });

  it("refuses a payment that is no longer paid (state_moved), with no writes", async () => {
    const c = execClient({ payment: { ...PAYMENT, status: "refunded" }, certs: CERTS });
    const res = await REGISTRY.create_print_task(c.client, { paymentId: "pay-1" });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("member_tasks")).toHaveLength(0);
  });

  it("inserts the fulfillment task with the marker, member scoping, and the real vocabulary", async () => {
    const c = execClient({ payment: PAYMENT, certs: CERTS });
    const res = await REGISTRY.create_print_task(c.client, { paymentId: "pay-1", memberId: "m1" });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ taskId: "task-9", paymentId: "pay-1", marker: MARKER });

    const inserts = c.callsFor("member_tasks", "insert");
    expect(inserts).toHaveLength(1);
    const payload = inserts[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      member_id: "m1",
      title: "Mail printed certificate",
      status: "open",
      priority: "high",
      visible_to_member: true,
      created_by: null,
    });
    const detail = String(payload.detail);
    expect(detail).toContain(MARKER); // the idempotency key
    expect(detail).toContain("$25.00"); // re-read from the payment row, not args
    expect(detail).toContain("CAC");
    expect(detail).toContain("AZ-1001");
  });

  it("is idempotent: no-ops ok when a task already carries the marker (no insert)", async () => {
    const c = execClient({ payment: PAYMENT, certs: CERTS, existingTask: { id: "task-1" } });
    const res = await REGISTRY.create_print_task(c.client, { paymentId: "pay-1" });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ taskId: "task-1", deduped: true });
    expect(c.callsFor("member_tasks", "insert")).toHaveLength(0);
    // the dedup lookup is member-scoped and matches the stable marker
    const lookup = c.callsFor("member_tasks", "select")[0];
    expect(lookup.filters).toContainEqual({ col: "member_id", val: "m1" });
    expect(lookup.filters).toContainEqual({ col: "detail", val: `%${MARKER}%` });
  });

  it("fails closed when the member has no certification at execute time", async () => {
    const c = execClient({ payment: PAYMENT, certs: [] });
    const res = await REGISTRY.create_print_task(c.client, { paymentId: "pay-1" });
    expect(res).toMatchObject({ ok: false, error: "no_certification_to_print" });
    expect(c.callsFor("member_tasks", "insert")).toHaveLength(0);
  });
});

// ── print_request sweep ───────────────────────────────────────────────────────
describe("sweepPrintRequest", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("dispatches paid print orders; skips other products and memberless rows", async () => {
    active = client((t) => {
      if (t === "payments")
        return {
          data: [
            { id: "pay-1", member_id: "m1", slug: PRINT_PRODUCT_SLUG, product_name: "Printed Certificate Copy", status: "paid" },
            { id: "pay-2", member_id: "m2", slug: "certification-sync", product_name: "Certification Sync", status: "paid" },
            { id: "pay-3", member_id: null, slug: PRINT_PRODUCT_SLUG, product_name: "Printed Certificate Copy", status: "paid" },
            // empty slug but a matching description — the defensive name match
            { id: "pay-4", member_id: "m4", slug: "", product_name: "Printed Certificate Copy", status: "paid" },
          ],
        };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepPrintRequest(active.client)).toEqual({ scanned: 4, dispatched: 2 });
    expect(dispatchMock).toHaveBeenCalledTimes(2);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "print_request", entityType: "payment", entityId: "pay-1", memberId: "m1" }),
    );
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "print_request", entityType: "payment", entityId: "pay-4", memberId: "m4" }),
    );
    // the scan itself only pulls recent paid rows
    const scan = active.callsFor("payments", "select")[0];
    expect(scan.filters).toContainEqual({ col: "status", val: "paid" });
    expect(scan.filters.some((f) => f.col === "created_at")).toBe(true);
  });

  it("dedups payments that already have a print_request run", async () => {
    active = client((t) => {
      if (t === "payments")
        return { data: [{ id: "pay-1", member_id: "m1", slug: PRINT_PRODUCT_SLUG, product_name: "Printed Certificate Copy", status: "paid" }] };
      // Batched dedup query returns the entity_ids that already have a run.
      if (t === "automation_runs") return { data: [{ entity_id: "pay-1" }] }; // already processed
      return { data: null };
    });
    expect(await sweepPrintRequest(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runAutomationSweep gates print_request on its enabled flag (ships disabled)", async () => {
    active = client((t) => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: false, auto_threshold: null, propose_threshold: null } };
      return { data: null };
    });
    const out = await runAutomationSweep();
    expect(out.print_request).toEqual({ skipped: "disabled" });
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
