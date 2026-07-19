import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ---------------------------------------------------------------

const constructEvent = vi.fn();
let stripeConfigured = true;

vi.mock("@/lib/stripe", () => ({
  get isStripeConfigured() {
    return stripeConfigured;
  },
  stripe: {
    webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) },
  },
}));

const sendEmail = vi.fn(async () => {});
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

vi.mock("@/lib/site-config", () => ({
  siteConfig: { name: "ABCAC", shortName: "ABCAC", contact: { email: "abcac@abcac.org", emailHref: "mailto:abcac@abcac.org", phone: "480-980-1770" } },
}));

let adminClient: ReturnType<typeof makeAdmin>;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => adminClient,
}));

import { POST } from "@/app/api/stripe/webhook/route";

// ---- Fake admin client ---------------------------------------------------
//
// Records insert/update calls per table and serves canned reads. Each
// .from(table) returns a fresh chainable builder; terminal read methods
// resolve to { data } configured via `reads`, and insert/update resolve to
// { error: null } while logging the payload to `calls`.

type Call = { table: string; op: string; payload?: unknown };

function makeAdmin(opts: {
  reads?: Partial<{
    payments: unknown; // idempotency lookup (.maybeSingle)
    profile: unknown; // profiles read (.maybeSingle)
    paymentSubmission: unknown;
  }>;
} = {}) {
  const calls: Call[] = [];
  const reads = opts.reads ?? {};

  function from(table: string) {
    const b: Record<string, unknown> = {};
    let pendingOp: string | null = null;
    b.insert = (payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      return { error: null };
    };
    b.update = (payload: unknown) => {
      pendingOp = "update";
      calls.push({ table, op: "update", payload });
      return b;
    };
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = async () => {
      if (table === "payments") return { data: reads.payments ?? null };
      if (table === "profiles") return { data: reads.profile ?? null };
      if (table === "payment_submissions") return { data: reads.paymentSubmission ?? null };
      return { data: null };
    };
    void pendingOp;
    return b;
  }

  return { from: vi.fn(from), calls };
}

function req(): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "raw-body",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeConfigured = true;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  adminClient = makeAdmin();
  sendEmail.mockClear();
});

describe("POST /api/stripe/webhook", () => {
  it("returns 500 when payments not configured / no webhook secret", async () => {
    stripeConfigured = false;
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "payments_not_configured" });

    stripeConfigured = true;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res2 = await POST(req());
    expect(res2.status).toBe(500);
  });

  it("rejects a request whose signature can't be verified (400)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("invalid signature");
  });

  it("is idempotent — ignores an event id already recorded", async () => {
    adminClient = makeAdmin({ reads: { payments: { id: "p-existing" } } });
    constructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", metadata: {} } },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    // No payment insert should have happened.
    expect(adminClient.calls.some((c) => c.table === "payments" && c.op === "insert")).toBe(false);
  });

  it("ignores irrelevant event types but still acknowledges (200)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_other",
      type: "customer.subscription.updated",
      data: { object: {} },
    });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(adminClient.calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("writes a payment row on checkout.session.completed", async () => {
    adminClient = makeAdmin({ reads: { profile: { email: "m@example.com", first_name: "Jo" }, paymentSubmission: { id: "ps-1", form_type: "general_payment", linked_record_type: null, linked_record_id: null, payer_first_name: "Jo", payer_last_name: "Member", payer_email: "m@example.com", payer_phone: "4805551212", reference_number: null, notes: null } } });
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          client_reference_id: "user-1",
          customer: "cus_9",
          amount_total: 25000,
          currency: "usd",
          mode: "payment",
          payment_intent: "pi_1",
          metadata: {
            slug: "initial-cert",
            product_name: "Initial Certification",
            member_id: "user-1",
            credential_level: "CACI",
            exam_mode: "remote",
            payment_submission_id: "ps-1",
          },
        },
      },
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const insert = adminClient.calls.find((c) => c.table === "payments" && c.op === "insert");
    expect(insert).toBeTruthy();
    expect(insert!.payload).toMatchObject({
      member_id: "user-1",
      stripe_session_id: "cs_123",
      stripe_event_id: "evt_1",
      slug: "initial-cert",
      product_name: "Initial Certification",
      amount_cents: 25000,
      currency: "usd",
      mode: "payment",
      credential_level: "CACI",
      exam_mode: "remote",
      status: "paid",
      payment_submission_id: "ps-1",
    });

    // Persists the stripe_customer_id back onto the profile.
    const profileUpdate = adminClient.calls.find(
      (c) => c.table === "profiles" && c.op === "update",
    );
    expect(profileUpdate!.payload).toMatchObject({ stripe_customer_id: "cus_9" });

    // Sends a best-effort receipt email.
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "m@example.com" });
    expect(sendEmail.mock.calls[1][0]).toMatchObject({ to: "abcac@abcac.org" });
  });

  it("marks a reciprocity request paid when metadata flags it", async () => {
    constructEvent.mockReturnValue({
      id: "evt_recip",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_recip",
          client_reference_id: "user-1",
          amount_total: 15000,
          currency: "usd",
          mode: "payment",
          metadata: {
            payment_type: "reciprocity",
            reciprocity_request_id: "rr-7",
            member_id: "user-1",
          },
        },
      },
    });

    await POST(req());
    const update = adminClient.calls.find((c) => c.table === "reciprocity_requests" && c.op === "update");
    expect(update).toBeTruthy();
    expect(update!.payload).toMatchObject({ payment_status: "paid", stripe_session_id: "cs_recip" });
  });

  it("marks an invoice paid when metadata carries invoice_id", async () => {
    constructEvent.mockReturnValue({
      id: "evt_inv",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_inv",
          client_reference_id: "user-1",
          payment_intent: "pi_42",
          amount_total: 15000,
          currency: "usd",
          mode: "payment",
          metadata: { invoice_id: "inv-1", member_id: "user-1" },
        },
      },
    });

    await POST(req());
    const update = adminClient.calls.find((c) => c.table === "invoices" && c.op === "update");
    expect(update).toBeTruthy();
    expect(update!.payload).toMatchObject({ status: "paid", stripe_payment_intent: "pi_42" });
  });

  it("moves a paid testing request into the SMT staff queue", async () => {
    constructEvent.mockReturnValue({
      id: "evt_testing",
      type: "checkout.session.completed",
      data: { object: { id: "cs_testing", client_reference_id: "user-1", amount_total: 22500, currency: "usd", mode: "payment", metadata: { payment_type: "testing", testing_request_id: "tr-1", exam_code: "ADC", member_id: "user-1" } } },
    });
    await POST(req());
    expect(adminClient.calls.find((c) => c.table === "testing_requests" && c.op === "update")?.payload).toMatchObject({ payment_status: "paid", status: "paid", stripe_session_id: "cs_testing" });
    expect(adminClient.calls.find((c) => c.table === "member_tasks" && c.op === "insert")?.payload).toMatchObject({ title: "Pre-register ADC exam candidate with SMT", priority: "high" });
    expect(adminClient.calls.find((c) => c.table === "notifications" && c.op === "insert")?.payload).toMatchObject({ link: "/account/testing" });
  });

  it("moves a paid certification sync request into admin review", async () => {
    constructEvent.mockReturnValue({
      id: "evt_sync",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_sync",
          client_reference_id: "user-1",
          amount_total: 9000,
          currency: "usd",
          mode: "payment",
          metadata: {
            slug: "certification-sync",
            member_id: "user-1",
            sync_months: "6",
            sync_application_id: "app-sync-1",
          },
        },
      },
    });

    await POST(req());
    const applicationUpdate = adminClient.calls.find((c) => c.table === "applications" && c.op === "update");
    expect(applicationUpdate?.payload).toEqual({ status: "under_review" });

    const taskUpdate = adminClient.calls.find((c) => c.table === "member_tasks" && c.op === "update");
    expect(taskUpdate?.payload).toMatchObject({
      detail: expect.stringContaining("app-sync-1"),
    });

    expect(adminClient.calls.find((c) => c.table === "certifications" && c.op === "update")).toBeUndefined();
  });

  it("writes a payment row on invoice.paid (renewal)", async () => {
    adminClient = makeAdmin({ reads: { profile: { id: "user-5" } } });
    constructEvent.mockReturnValue({
      id: "evt_renew",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          billing_reason: "subscription_cycle",
          customer: "cus_5",
          amount_paid: 1200,
          currency: "usd",
          lines: { data: [{ description: "Annual provider fee renewal" }] },
        },
      },
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    const insert = adminClient.calls.find((c) => c.table === "payments" && c.op === "insert");
    expect(insert!.payload).toMatchObject({
      member_id: "user-5",
      stripe_session_id: "in_1",
      stripe_event_id: "evt_renew",
      product_name: "Annual provider fee renewal",
      amount_cents: 1200,
      mode: "subscription",
      status: "paid",
    });
  });

  it("skips the first subscription invoice (handled by checkout.session.completed)", async () => {
    constructEvent.mockReturnValue({
      id: "evt_first",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_first",
          billing_reason: "subscription_create",
          customer: "cus_5",
          amount_paid: 1200,
          currency: "usd",
          lines: { data: [] },
        },
      },
    });

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(adminClient.calls.some((c) => c.table === "payments" && c.op === "insert")).toBe(false);
  });
});
