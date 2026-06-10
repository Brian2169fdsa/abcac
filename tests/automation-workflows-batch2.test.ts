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

import { dunningRule, DUNNING_AGE_DAYS } from "@/lib/automation/workflows/dunning";
import { invoiceGenerationRule, RENEWAL_FEE_CENTS } from "@/lib/automation/workflows/invoice-generation";
import { docRequestRule } from "@/lib/automation/workflows/doc-request";
import { REGISTRY } from "@/lib/automation/registry";
import {
  sweepDunning,
  sweepInvoiceGeneration,
  sweepDocRequest,
  runAutomationSweep,
} from "@/lib/automation/sweep";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function client(map: (t: string, op: Op) => QueryResult): FakeClient {
  return makeClient({ id: "admin" }, map);
}

// ── dunning rule ──────────────────────────────────────────────────────────────
describe("dunningRule", () => {
  const INPUT = { workflow: "dunning", entityType: "invoice", entityId: "inv-1" };

  it("returns null for missing / paid / not-yet-overdue invoices", async () => {
    expect(await dunningRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await dunningRule(
        client(() => ({ data: { id: "inv-1", member_id: "m1", status: "paid", created_at: daysAgo(90) } })).client,
        INPUT,
      ),
    ).toBeNull();
    expect(
      await dunningRule(
        client(() => ({ data: { id: "inv-1", member_id: "m1", status: "unpaid", created_at: daysAgo(DUNNING_AGE_DAYS - 3) } }))
          .client,
        INPUT,
      ),
    ).toBeNull();
  });

  it("stages a reminder for an overdue unpaid invoice", async () => {
    const rec = { id: "inv-1", member_id: "m1", status: "unpaid", invoice_number: "INV-2026-0007", amount_cents: 15000, created_at: daysAgo(30) };
    const r = await dunningRule(client(() => ({ data: rec })).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.action?.handler).toBe("send_member_message");
    expect(r?.action?.args.memberId).toBe("m1");
    expect(String(r?.action?.args.subject)).toContain("INV-2026-0007");
    expect(String(r?.action?.args.body)).toContain("$150");
  });
});

// ── invoice_generation rule ───────────────────────────────────────────────────
describe("invoiceGenerationRule", () => {
  const INPUT = { workflow: "invoice_generation", entityType: "certification", entityId: "c-1" };

  it("ignores non-active, missing, or out-of-window certs", async () => {
    expect(await invoiceGenerationRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await invoiceGenerationRule(
        client(() => ({ data: { id: "c-1", member_id: "m1", status: "expired", cert_type: "CAC", expiration_date: daysAhead(10) } })).client,
        INPUT,
      ),
    ).toBeNull();
    expect(
      await invoiceGenerationRule(
        client(() => ({ data: { id: "c-1", member_id: "m1", status: "active", cert_type: "CAC", expiration_date: daysAhead(200) } })).client,
        INPUT,
      ),
    ).toBeNull();
  });

  it("generates a renewal invoice for a cert inside the window", async () => {
    const rec = { id: "c-1", member_id: "m1", status: "active", cert_type: "CADAC", expiration_date: daysAhead(30) };
    const r = await invoiceGenerationRule(client(() => ({ data: rec })).client, INPUT);
    expect(r?.action?.handler).toBe("create_invoice");
    expect(r?.action?.args).toMatchObject({ memberId: "m1", amountCents: RENEWAL_FEE_CENTS, certId: "c-1" });
    expect(String(r?.action?.args.description)).toContain("CADAC");
  });
});

// ── doc_request rule ──────────────────────────────────────────────────────────
describe("docRequestRule", () => {
  const INPUT = { workflow: "doc_request", entityType: "application", entityId: "app-1" };

  it("requests the required doc when the member hasn't supplied it", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: { id: "app-1", member_id: "m1", app_type: "initial_certification", status: "submitted" } };
      if (t === "documents") return { data: null };
      if (t === "document_requests") return { data: null };
      return { data: null };
    });
    const r = await docRequestRule(c.client, INPUT);
    expect(r?.action?.handler).toBe("request_document");
    expect(r?.action?.args).toMatchObject({ memberId: "m1", documentType: "Education Verification" });
  });

  it("is a no-op when the doc already exists", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: { id: "app-1", member_id: "m1", app_type: "initial_certification", status: "submitted" } };
      if (t === "documents") return { data: { id: "doc-1" } };
      return { data: null };
    });
    expect(await docRequestRule(c.client, INPUT)).toBeNull();
  });

  it("ignores app types with no required-doc rule and non-review statuses", async () => {
    const c1 = client((t) => (t === "applications" ? { data: { id: "app-1", member_id: "m1", app_type: "name_change", status: "submitted" } } : { data: null }));
    expect(await docRequestRule(c1.client, INPUT)).toBeNull();
    const c2 = client((t) => (t === "applications" ? { data: { id: "app-1", member_id: "m1", app_type: "initial_certification", status: "approved" } } : { data: null }));
    expect(await docRequestRule(c2.client, INPUT)).toBeNull();
  });
});

// ── create_invoice executor ───────────────────────────────────────────────────
describe("create_invoice executor", () => {
  it("rejects bad args", async () => {
    const res = await REGISTRY.create_invoice(client(() => ({ data: null })).client, { memberId: "m1", description: "X", amountCents: 0 });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("bad_args");
  });

  it("inserts an unpaid invoice when none exists", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select") return { data: null }; // no dup
      if (t === "invoices" && op === "insert") return { data: { id: "new-inv" } };
      return { data: null };
    });
    const res = await REGISTRY.create_invoice(c.client, { memberId: "m1", description: "Biennial certification renewal — CAC", amountCents: 15000 });
    expect(res.ok).toBe(true);
    const ins = c.callsFor("invoices", "insert")[0].payload as Record<string, unknown>;
    expect(ins).toMatchObject({ member_id: "m1", amount_cents: 15000, status: "unpaid" });
    expect(String(ins.invoice_number)).toMatch(/^INV-AUTO-/);
  });

  it("dedups against an existing unpaid invoice (no double-billing)", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select") return { data: { id: "existing" } };
      return { data: null };
    });
    const res = await REGISTRY.create_invoice(c.client, { memberId: "m1", description: "Biennial certification renewal — CAC", amountCents: 15000 });
    expect(res.ok).toBe(true);
    expect((res.after as { deduped?: boolean }).deduped).toBe(true);
    expect(c.callsFor("invoices", "insert")).toHaveLength(0);
  });
});

// ── sweeps ────────────────────────────────────────────────────────────────────
describe("sweeps", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("sweepDunning dispatches overdue invoices without an existing run", async () => {
    active = client((t, op) => {
      if (t === "invoices" && op === "select") return { data: [{ id: "i1", member_id: "m1" }, { id: "i2", member_id: "m2" }] };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepDunning(active.client)).toEqual({ scanned: 2, dispatched: 2 });
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({ workflow: "dunning", entityId: "i1", memberId: "m1" }));
  });

  it("sweepInvoiceGeneration dispatches certs in the renewal window", async () => {
    active = client((t, op) => {
      if (t === "certifications" && op === "select") return { data: [{ id: "c1", member_id: "m1" }] };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepInvoiceGeneration(active.client)).toEqual({ scanned: 1, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({ workflow: "invoice_generation", entityId: "c1" }));
  });

  it("sweepDocRequest skips applications already covered by a doc", async () => {
    active = client((t) => {
      if (t === "applications") return { data: [{ id: "a1", member_id: "m1", app_type: "initial_certification" }] };
      if (t === "documents") return { data: { id: "doc-exists" } }; // covered
      return { data: null };
    });
    expect(await sweepDocRequest(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("sweepDocRequest dispatches uncovered applications", async () => {
    active = client((t) => {
      if (t === "applications") return { data: [{ id: "a1", member_id: "m1", app_type: "renewal" }] };
      if (t === "documents") return { data: null };
      if (t === "document_requests") return { data: null };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepDocRequest(active.client)).toEqual({ scanned: 1, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledWith(expect.objectContaining({ workflow: "doc_request", entityId: "a1" }));
  });

  it("runAutomationSweep gates every scan on its enabled flag", async () => {
    active = client((t) => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: false, auto_threshold: null, propose_threshold: null } };
      return { data: null };
    });
    const out = await runAutomationSweep();
    for (const wf of ["ceu_review", "dunning", "invoice_generation", "doc_request"]) {
      expect(out[wf]).toEqual({ skipped: "disabled" });
    }
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
