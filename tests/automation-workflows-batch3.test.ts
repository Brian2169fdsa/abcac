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

import { paymentReconciliationRule } from "@/lib/automation/workflows/payment-reconciliation";
import {
  certificateIssuanceRule,
  renewalTargetExpiration,
  CERT_EXTENSION_YEARS,
} from "@/lib/automation/workflows/certificate-issuance";
import { reciprocityRule } from "@/lib/automation/workflows/reciprocity";
import { refundVoidRule } from "@/lib/automation/workflows/refund-void";
import { REGISTRY } from "@/lib/automation/registry";
import {
  sweepPaymentReconciliation,
  sweepCertificateIssuance,
  sweepReciprocity,
  runAutomationSweep,
} from "@/lib/automation/sweep";

const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function client(map: (t: string, op: Op) => QueryResult): FakeClient {
  return makeClient({ id: "admin" }, map);
}

// ── payment_reconciliation rule ───────────────────────────────────────────────
describe("paymentReconciliationRule", () => {
  const INPUT = { workflow: "payment_reconciliation", entityType: "payment", entityId: "pay-1" };
  const PAYMENT = {
    id: "pay-1",
    member_id: "m1",
    status: "paid",
    amount_cents: 15000,
    stripe_session_id: "cs_123",
    product_name: "Biennial renewal",
  };

  it("returns null for missing / memberless / not-completed payments", async () => {
    expect(await paymentReconciliationRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await paymentReconciliationRule(
        client((t) => (t === "payments" ? { data: { ...PAYMENT, member_id: null } } : { data: null })).client,
        INPUT,
      ),
    ).toBeNull();
    expect(
      await paymentReconciliationRule(
        client((t) => (t === "payments" ? { data: { ...PAYMENT, status: "refunded" } } : { data: null })).client,
        INPUT,
      ),
    ).toBeNull();
  });

  it("returns null when no unpaid invoice matches the amount", async () => {
    const c = client((t) => {
      if (t === "payments") return { data: PAYMENT };
      if (t === "invoices") return { data: [] };
      return { data: null };
    });
    expect(await paymentReconciliationRule(c.client, INPUT)).toBeNull();
  });

  it("auto-marks the invoice paid when exactly one unpaid invoice matches", async () => {
    const c = client((t) => {
      if (t === "payments") return { data: PAYMENT };
      if (t === "invoices")
        return { data: [{ id: "inv-1", invoice_number: "INV-2026-0042", status: "unpaid", amount_cents: 15000 }] };
      return { data: null };
    });
    const r = await paymentReconciliationRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.action?.handler).toBe("mark_invoice_paid");
    expect(r?.action?.args).toMatchObject({ invoiceId: "inv-1", memberId: "m1", stripeSessionId: "cs_123" });
    expect(String(r?.summary)).toContain("INV-2026-0042");
  });

  it("escalates an ambiguous multi-invoice match with no action", async () => {
    const c = client((t) => {
      if (t === "payments") return { data: PAYMENT };
      if (t === "invoices")
        return {
          data: [
            { id: "inv-1", invoice_number: "INV-A", status: "unpaid", amount_cents: 15000 },
            { id: "inv-2", invoice_number: "INV-B", status: "unpaid", amount_cents: 15000 },
          ],
        };
      return { data: null };
    });
    const r = await paymentReconciliationRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("ambiguous_invoice_match");
    expect(String(r?.summary)).toContain("INV-A");
    expect(String(r?.summary)).toContain("INV-B");
  });
});

// ── certificate_issuance rule ─────────────────────────────────────────────────
describe("certificateIssuanceRule", () => {
  const INPUT = { workflow: "certificate_issuance", entityType: "application", entityId: "app-1" };
  const RENEWAL_APP = { id: "app-1", member_id: "m1", app_type: "renewal", status: "approved", cert_type: "CAC" };

  it("returns null for missing / non-approved / out-of-scope applications", async () => {
    expect(await certificateIssuanceRule(client(() => ({ data: null })).client, INPUT)).toBeNull();
    expect(
      await certificateIssuanceRule(
        client((t) => (t === "applications" ? { data: { ...RENEWAL_APP, status: "under_review" } } : { data: null })).client,
        INPUT,
      ),
    ).toBeNull();
    expect(
      await certificateIssuanceRule(
        client((t) => (t === "applications" ? { data: { ...RENEWAL_APP, app_type: "name_change" } } : { data: null })).client,
        INPUT,
      ),
    ).toBeNull();
  });

  it("escalates an approved-but-unpaid renewal (M3 paid-guard)", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: RENEWAL_APP };
      if (t === "invoices") return { data: [] }; // no paid invoices at all
      if (t === "payments") return { data: null }; // no payment for the app
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("approved_unpaid");
    expect(String(r?.summary)).toContain("unpaid");
  });

  it("a paid invoice that doesn't mention renewal does not satisfy the guard", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: RENEWAL_APP };
      if (t === "invoices") return { data: [{ id: "inv-9", description: "Exam fee" }] };
      if (t === "payments") return { data: null };
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.anomalies).toContain("approved_unpaid");
  });

  it("auto-extends the active cert for a renewal paid via invoice", async () => {
    const exp = daysAhead(30);
    const c = client((t) => {
      if (t === "applications") return { data: RENEWAL_APP };
      if (t === "invoices") return { data: [{ id: "inv-1", description: "Biennial certification renewal — CAC" }] };
      if (t === "certifications")
        return { data: { id: "c-1", member_id: "m1", status: "active", cert_type: "CAC", expiration_date: exp } };
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.action?.handler).toBe("extend_certification");
    expect(r?.action?.args).toMatchObject({ certId: "c-1", memberId: "m1", targetExpiration: renewalTargetExpiration(exp) });
  });

  it("auto-extends for a renewal paid via a completed payment on the application", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: RENEWAL_APP };
      if (t === "invoices") return { data: [] };
      if (t === "payments") return { data: { id: "pay-7" } };
      if (t === "certifications")
        return { data: { id: "c-1", member_id: "m1", status: "active", cert_type: "CAC", expiration_date: daysAhead(10) } };
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.tier).toBe("auto");
    expect(r?.action?.handler).toBe("extend_certification");
  });

  it("escalates a paid renewal when the member has no active cert to extend", async () => {
    const c = client((t) => {
      if (t === "applications") return { data: RENEWAL_APP };
      if (t === "invoices") return { data: [{ id: "inv-1", description: "renewal" }] };
      if (t === "certifications") return { data: null };
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("no_active_certification");
  });

  it("escalates a PAID initial certification (cert number is a human ceremony)", async () => {
    const c = client((t) => {
      if (t === "applications")
        return { data: { ...RENEWAL_APP, app_type: "initial_certification", cert_type: "CADAC" } };
      if (t === "invoices") return { data: [] };
      if (t === "payments") return { data: { id: "pay-1" } };
      return { data: null };
    });
    const r = await certificateIssuanceRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(String(r?.summary)).toContain("cert number");
    // No certifications row is ever created/queried for an initial issuance.
    expect(c.callsFor("certifications")).toHaveLength(0);
  });

  it("renewalTargetExpiration extends from the later of today / current expiration", () => {
    const now = new Date("2026-06-11T00:00:00Z");
    // future expiration → +2y from the expiration
    expect(renewalTargetExpiration("2026-12-01", now)).toBe(`${2026 + CERT_EXTENSION_YEARS}-12-01`);
    // lapsed expiration → +2y from today
    expect(renewalTargetExpiration("2020-01-01", now)).toBe(`${2026 + CERT_EXTENSION_YEARS}-06-11`);
    // missing expiration → +2y from today
    expect(renewalTargetExpiration(null, now)).toBe(`${2026 + CERT_EXTENSION_YEARS}-06-11`);
  });
});

// ── reciprocity rule (permanent human gate) ───────────────────────────────────
describe("reciprocityRule", () => {
  const INPUT = { workflow: "reciprocity", entityType: "reciprocity_request", entityId: "rr-1" };

  it("always escalates with a useful summary and never stages an action", async () => {
    const c = client((t) =>
      t === "reciprocity_requests"
        ? {
            data: {
              id: "rr-1",
              member_id: "m1",
              direction: "out_of_az",
              credential: "CAC",
              destination: "Nevada",
              status: "pending",
              payment_status: "paid",
              fee_cents: 15000,
            },
          }
        : { data: null },
    );
    const r = await reciprocityRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(String(r?.summary)).toContain("out of Arizona");
    expect(String(r?.summary)).toContain("CAC");
    expect(String(r?.summary)).toContain("Nevada");
    expect(String(r?.summary)).toContain("$150 fee paid");
  });

  it("escalates (never automates) even when the request is missing or unpaid", async () => {
    const missing = await reciprocityRule(client(() => ({ data: null })).client, INPUT);
    expect(missing?.decisive).toBe(true);
    expect(missing?.tier).toBe("escalate");
    expect(missing?.action).toBeUndefined();
    expect(missing?.anomalies).toContain("not_found");

    const unpaid = await reciprocityRule(
      client((t) =>
        t === "reciprocity_requests"
          ? { data: { id: "rr-1", direction: "into_az", credential: "CADAC", destination: "Arizona", status: "pending", payment_status: "unpaid", fee_cents: 15000 } }
          : { data: null },
      ).client,
      INPUT,
    );
    expect(unpaid?.tier).toBe("escalate");
    expect(String(unpaid?.summary)).toContain("not paid");
  });
});

// ── refund_void rule (permanent human gate) ───────────────────────────────────
describe("refundVoidRule", () => {
  const INPUT = { workflow: "refund_void", entityType: "invoice", entityId: "inv-1" };

  it("always escalates with the invoice status/amount and never stages an action", async () => {
    const c = client((t) =>
      t === "invoices"
        ? { data: { id: "inv-1", member_id: "m1", invoice_number: "INV-2026-0007", status: "paid", amount_cents: 15000, paid_at: `${daysAgo(3)}T12:00:00Z` } }
        : { data: null },
    );
    const r = await refundVoidRule(c.client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(String(r?.summary)).toContain("INV-2026-0007");
    expect(String(r?.summary)).toContain("$150");
    expect(String(r?.summary)).toContain("status paid");
  });

  it("escalates even for a missing invoice (no automated refund path exists)", async () => {
    const r = await refundVoidRule(client(() => ({ data: null })).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("not_found");
  });
});

// ── mark_invoice_paid executor ────────────────────────────────────────────────
describe("mark_invoice_paid executor", () => {
  it("rejects missing id and unknown invoice", async () => {
    expect((await REGISTRY.mark_invoice_paid(client(() => ({ data: null })).client, {})).error).toBe("missing_invoice_id");
    const res = await REGISTRY.mark_invoice_paid(client(() => ({ data: null })).client, { invoiceId: "inv-x" });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
  });

  it("marks an unpaid invoice paid and stamps the session id when empty", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select")
        return { data: { id: "inv-1", status: "unpaid", paid_at: null, stripe_payment_intent: null } };
      return { data: null };
    });
    const res = await REGISTRY.mark_invoice_paid(c.client, { invoiceId: "inv-1", memberId: "m1", stripeSessionId: "cs_123" });
    expect(res.ok).toBe(true);
    const upd = c.callsFor("invoices", "update")[0];
    expect(upd.payload).toMatchObject({ status: "paid", stripe_payment_intent: "cs_123" });
    expect((upd.payload as { paid_at?: string }).paid_at).toBeTruthy();
    // race guard: the update is conditioned on status still being unpaid
    expect(upd.filters).toContainEqual({ col: "status", val: "unpaid" });
  });

  it("does not overwrite an existing stripe_payment_intent", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select")
        return { data: { id: "inv-1", status: "unpaid", paid_at: null, stripe_payment_intent: "pi_original" } };
      return { data: null };
    });
    const res = await REGISTRY.mark_invoice_paid(c.client, { invoiceId: "inv-1", stripeSessionId: "cs_new" });
    expect(res.ok).toBe(true);
    const patch = c.callsFor("invoices", "update")[0].payload as Record<string, unknown>;
    expect("stripe_payment_intent" in patch).toBe(false);
  });

  it("is idempotent: an already-paid invoice is an ok no-op", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select") return { data: { id: "inv-1", status: "paid" } };
      return { data: null };
    });
    const res = await REGISTRY.mark_invoice_paid(c.client, { invoiceId: "inv-1" });
    expect(res.ok).toBe(true);
    expect(c.callsFor("invoices", "update")).toHaveLength(0);
  });

  it("refuses a refunded invoice (state_moved)", async () => {
    const c = client((t, op) => {
      if (t === "invoices" && op === "select") return { data: { id: "inv-1", status: "refunded" } };
      return { data: null };
    });
    const res = await REGISTRY.mark_invoice_paid(c.client, { invoiceId: "inv-1" });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("invoices", "update")).toHaveLength(0);
  });
});

// ── extend_certification executor ─────────────────────────────────────────────
describe("extend_certification executor", () => {
  it("rejects bad args (missing/garbled/absurd target)", async () => {
    const c = () => client(() => ({ data: null })).client;
    expect((await REGISTRY.extend_certification(c(), { certId: "c-1" })).error).toBe("bad_args");
    expect((await REGISTRY.extend_certification(c(), { certId: "c-1", targetExpiration: "soon" })).error).toBe("bad_args");
    expect((await REGISTRY.extend_certification(c(), { certId: "c-1", targetExpiration: "2099-01-01" })).error).toBe("bad_args");
    expect((await REGISTRY.extend_certification(c(), { targetExpiration: daysAhead(30) })).error).toBe("bad_args");
  });

  it("returns not_found for an unknown cert", async () => {
    const res = await REGISTRY.extend_certification(client(() => ({ data: null })).client, { certId: "c-x", targetExpiration: daysAhead(365) });
    expect(res).toMatchObject({ ok: false, error: "not_found" });
  });

  it("extends an active cert to the staged target", async () => {
    const target = daysAhead(730);
    const c = client((t, op) => {
      if (t === "certifications" && op === "select")
        return { data: { id: "c-1", status: "active", expiration_date: daysAhead(20) } };
      return { data: null };
    });
    const res = await REGISTRY.extend_certification(c.client, { certId: "c-1", memberId: "m1", targetExpiration: target });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ id: "c-1", expirationDate: target });
    const upd = c.callsFor("certifications", "update")[0];
    expect(upd.payload).toMatchObject({ expiration_date: target });
    expect(upd.filters).toContainEqual({ col: "status", val: "active" });
  });

  it("is idempotent: an expiration already at/past the target is an ok no-op", async () => {
    const target = daysAhead(365);
    const c = client((t, op) => {
      if (t === "certifications" && op === "select")
        return { data: { id: "c-1", status: "active", expiration_date: daysAhead(730) } };
      return { data: null };
    });
    const res = await REGISTRY.extend_certification(c.client, { certId: "c-1", targetExpiration: target });
    expect(res.ok).toBe(true);
    expect(c.callsFor("certifications", "update")).toHaveLength(0);
  });

  it("refuses a cert that is no longer active (state_moved)", async () => {
    const c = client((t, op) => {
      if (t === "certifications" && op === "select")
        return { data: { id: "c-1", status: "suspended", expiration_date: daysAhead(20) } };
      return { data: null };
    });
    const res = await REGISTRY.extend_certification(c.client, { certId: "c-1", targetExpiration: daysAhead(365) });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
    expect(c.callsFor("certifications", "update")).toHaveLength(0);
  });
});

// ── sweeps ────────────────────────────────────────────────────────────────────
describe("batch-3 sweeps", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("sweepPaymentReconciliation dispatches payments with a matching unpaid invoice", async () => {
    active = client((t) => {
      if (t === "payments") return { data: [{ id: "p1", member_id: "m1", status: "paid", amount_cents: 15000 }] };
      if (t === "invoices") return { data: { id: "inv-1" } }; // pre-filter match
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepPaymentReconciliation(active.client)).toEqual({ scanned: 1, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "payment_reconciliation", entityType: "payment", entityId: "p1", memberId: "m1" }),
    );
  });

  it("sweepPaymentReconciliation skips memberless payments and ones with no invoice match", async () => {
    active = client((t) => {
      if (t === "payments")
        return { data: [{ id: "p1", member_id: null, status: "paid", amount_cents: 15000 }, { id: "p2", member_id: "m2", status: "paid", amount_cents: 9900 }] };
      if (t === "invoices") return { data: null }; // no matching unpaid invoice
      return { data: null };
    });
    expect(await sweepPaymentReconciliation(active.client)).toEqual({ scanned: 2, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("sweepPaymentReconciliation dedups payments that already have a run", async () => {
    active = client((t) => {
      if (t === "payments") return { data: [{ id: "p1", member_id: "m1", status: "paid", amount_cents: 15000 }] };
      if (t === "invoices") return { data: { id: "inv-1" } };
      if (t === "automation_runs") return { data: { id: "run-1" } }; // already processed
      return { data: null };
    });
    expect(await sweepPaymentReconciliation(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("sweepCertificateIssuance dispatches approved initial/renewal applications", async () => {
    active = client((t) => {
      if (t === "applications")
        return { data: [{ id: "a1", member_id: "m1", app_type: "renewal" }, { id: "a2", member_id: null, app_type: "initial_certification" }] };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepCertificateIssuance(active.client)).toEqual({ scanned: 2, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "certificate_issuance", entityType: "application", entityId: "a1", memberId: "m1" }),
    );
  });

  it("sweepCertificateIssuance dedups applications that already have a run", async () => {
    active = client((t) => {
      if (t === "applications") return { data: [{ id: "a1", member_id: "m1", app_type: "renewal" }] };
      if (t === "automation_runs") return { data: { id: "run-1" } };
      return { data: null };
    });
    expect(await sweepCertificateIssuance(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("sweepReciprocity dispatches pending requests and dedups processed ones", async () => {
    active = client((t) => {
      if (t === "reciprocity_requests") return { data: [{ id: "rr-1", member_id: "m1", status: "pending" }] };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepReciprocity(active.client)).toEqual({ scanned: 1, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "reciprocity", entityType: "reciprocity_request", entityId: "rr-1", memberId: "m1" }),
    );

    dispatchMock.mockClear();
    active = client((t) => {
      if (t === "reciprocity_requests") return { data: [{ id: "rr-1", member_id: "m1", status: "pending" }] };
      if (t === "automation_runs") return { data: { id: "run-1" } };
      return { data: null };
    });
    expect(await sweepReciprocity(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runAutomationSweep gates the batch-3 scans on their enabled flags (refund_void has none)", async () => {
    active = client((t) => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: false, auto_threshold: null, propose_threshold: null } };
      return { data: null };
    });
    const out = await runAutomationSweep();
    for (const wf of ["payment_reconciliation", "certificate_issuance", "reciprocity"]) {
      expect(out[wf]).toEqual({ skipped: "disabled" });
    }
    expect(out.refund_void).toBeUndefined(); // ad hoc only — never swept
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
