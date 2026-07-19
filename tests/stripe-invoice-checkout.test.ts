import { describe, it, expect, vi, beforeEach } from "vitest";

const sessionsCreate = vi.fn();
let stripeConfigured = true;

vi.mock("@/lib/stripe", () => ({
  get isStripeConfigured() {
    return stripeConfigured;
  },
  stripe: {
    checkout: { sessions: { create: (...a: unknown[]) => sessionsCreate(...a) } },
  },
}));

let serverClient: unknown;
let adminClient: unknown;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverClient,
  createSupabaseAdminClient: () => adminClient,
}));

import { POST } from "@/app/api/stripe/invoice-checkout/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/stripe/invoice-checkout", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeServer(user: { id: string; email?: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } };
}

// Admin client whose .from("invoices").select().eq().single() resolves to `invoice`.
function fakeAdmin(invoice: Record<string, unknown> | null) {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  return {
    calls,
    from(table: string) {
      const b: Record<string, unknown> = {};
      b.insert = (payload: unknown) => { calls.push({ table, op: "insert", payload }); return b; };
      b.update = (payload: unknown) => { calls.push({ table, op: "update", payload }); return b; };
      b.select = () => b;
      b.eq = () => b;
      b.single = async () => ({ data: table === "payment_submissions" ? { id: "ps-invoice" } : invoice, error: null });
      return b;
    },
  };
}

const INVOICE = {
  id: "inv-1",
  member_id: "user-1",
  status: "open",
  currency: "usd",
  amount_cents: 15000,
  description: "Annual provider fee",
  invoice_number: "INV-0001",
};

beforeEach(() => {
  vi.clearAllMocks();
  stripeConfigured = true;
  serverClient = fakeServer({ id: "user-1", email: "m@example.com" });
  adminClient = fakeAdmin(INVOICE);
  sessionsCreate.mockResolvedValue({ id: "cs_invoice", url: "https://stripe.test/inv-session" });
});

describe("POST /api/stripe/invoice-checkout", () => {
  it("returns 503 when Stripe is not configured", async () => {
    stripeConfigured = false;
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments_not_configured" });
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(req("{bad"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("returns 400 when invoice_id is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing invoice_id" });
  });

  it("returns 401 when not authenticated", async () => {
    serverClient = fakeServer(null);
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 404 when the invoice does not exist", async () => {
    adminClient = fakeAdmin(null);
    const res = await POST(req({ invoice_id: "inv-x" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "invoice_not_found" });
  });

  it("returns 403 when the invoice belongs to another member", async () => {
    adminClient = fakeAdmin({ ...INVOICE, member_id: "someone-else" });
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("returns 409 when the invoice is already paid", async () => {
    adminClient = fakeAdmin({ ...INVOICE, status: "paid" });
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_paid" });
  });

  it("builds a session with the invoice amount and metadata", async () => {
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://stripe.test/inv-session" });

    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items[0].quantity).toBe(1);
    expect(arg.line_items[0].price_data.currency).toBe("usd");
    expect(arg.line_items[0].price_data.unit_amount).toBe(15000);
    expect(arg.line_items[0].price_data.product_data.name).toBe("Annual provider fee");
    expect(arg.line_items[0].price_data.product_data.description).toBe("Invoice INV-0001");
    expect(arg.customer_email).toBe("m@example.com");
    expect(arg.client_reference_id).toBe("user-1");
    expect(arg.metadata).toEqual({
      invoice_id: "inv-1",
      member_id: "user-1",
      product_name: "Annual provider fee",
      slug: "invoice",
      payment_submission_id: "ps-invoice",
      form_type: "invoice",
      linked_record_type: "invoices",
      linked_record_id: "inv-1",
    });
    expect(arg.success_url).toContain("/account/invoices?paid=1");
    expect(arg.cancel_url).toContain("/account/invoices");
  });

  it("defaults currency to usd when the invoice has none", async () => {
    adminClient = fakeAdmin({ ...INVOICE, currency: null });
    await POST(req({ invoice_id: "inv-1" }));
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.line_items[0].price_data.currency).toBe("usd");
  });

  it("returns 500 checkout_failed when Stripe throws", async () => {
    sessionsCreate.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "checkout_failed" });
  });
});
