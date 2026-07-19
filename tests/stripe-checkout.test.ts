import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ---------------------------------------------------------------

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

const getProductBySlug = vi.fn();
const getPriceId = vi.fn();
vi.mock("@/lib/catalog", () => ({
  getProductBySlug: (s: string) => getProductBySlug(s),
  getPriceId: (s: string) => getPriceId(s),
}));

// Supabase server client — by default, a signed-in member (checkout requires auth).
let serverClient: unknown;
let adminClient: ReturnType<typeof fakeAdminClient>;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverClient,
  createSupabaseAdminClient: () => adminClient,
}));

import { POST } from "@/app/api/stripe/checkout/route";

function req(body: unknown): Request {
  const withPaymentForm = body && typeof body === "object" && !Array.isArray(body) && "slug" in body && !("paymentForm" in body)
    ? { ...body, paymentForm: PAYMENT_FORM }
    : body;
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: typeof withPaymentForm === "string" ? withPaymentForm : JSON.stringify(withPaymentForm),
  });
}

const PAYMENT_FORM = { firstName: "Jamie", lastName: "Counselor", email: "jamie@example.com", phone: "480-555-1212" };

function fakeAdminClient() {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  return {
    calls,
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.insert = (payload: unknown) => { calls.push({ table, op: "insert", payload }); return builder; };
      builder.update = (payload: unknown) => { calls.push({ table, op: "update", payload }); return builder; };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.single = async () => ({ data: { id: "ps-1" }, error: null });
      return builder;
    },
  };
}

// A chainable supabase builder whose terminal methods resolve to { data }.
function fakeProfileClient(opts: {
  user: { id: string; email?: string } | null;
  profile?: { stripe_customer_id?: string | null } | null;
  testingRequest?: Record<string, unknown> | null;
  reciprocityRequest?: Record<string, unknown> | null;
  syncApplication?: Record<string, unknown> | null;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => ({ data: table === "testing_requests" ? opts.testingRequest ?? null : table === "reciprocity_requests" ? opts.reciprocityRequest ?? null : table === "applications" ? opts.syncApplication ?? null : opts.profile ?? null });
      return builder;
    },
  };
}

const PRODUCT = {
  slug: "initial-cert",
  name: "Initial Certification",
  mode: "payment" as const,
  category: "Certification",
};

beforeEach(() => {
  vi.clearAllMocks();
  stripeConfigured = true;
  serverClient = fakeProfileClient({ user: { id: "member-1", email: "jamie@example.com" }, profile: null });
  adminClient = fakeAdminClient();
  getProductBySlug.mockReturnValue(PRODUCT);
  getPriceId.mockReturnValue("price_123");
  sessionsCreate.mockResolvedValue({ id: "cs_test", url: "https://stripe.test/session" });
});

describe("POST /api/stripe/checkout", () => {
  it("returns 503 payments_not_configured when Stripe is unset", async () => {
    stripeConfigured = false;
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments_not_configured" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("returns 400 when slug is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing_slug" });
  });

  it("returns 404 when product not found", async () => {
    getProductBySlug.mockReturnValue(undefined);
    const res = await POST(req({ slug: "nope" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "product_not_found" });
  });

  it("returns 503 price_not_found when the price id is missing", async () => {
    getPriceId.mockReturnValue(undefined);
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "price_not_found" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects guest checkout — payments require a member account", async () => {
    serverClient = fakeProfileClient({ user: null });
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "authentication_required" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("builds a member session with the right price and urls", async () => {
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://stripe.test/session" });

    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(arg.success_url).toContain("/checkout/success?session_id={CHECKOUT_SESSION_ID}");
    expect(arg.cancel_url).toContain("/checkout/cancel");
    expect(arg.customer_email).toBe("jamie@example.com");
    expect(arg.client_reference_id).toBe("member-1");
    expect(arg.metadata.slug).toBe("initial-cert");
    expect(arg.metadata.member_id).toBe("member-1");
    expect(arg.metadata.payment_submission_id).toBe("ps-1");
    expect(adminClient.calls.find((call) => call.table === "payment_submissions" && call.op === "insert")).toBeTruthy();
  });

  it("links an application-packet fee to the application and forwards webhook metadata", async () => {
    serverClient = fakeProfileClient({
      user: { id: "member-1", email: "jamie@example.com" },
      syncApplication: { id: "app-9", app_type: "initial", cert_type: "CAC", status: "submitted" },
    });
    const res = await POST(req({ slug: "initial-cert", applicationId: "app-9" }));
    expect(res.status).toBe(200);
    const insert = adminClient.calls.find((call) => call.table === "payment_submissions" && call.op === "insert");
    expect((insert?.payload as any).linked_record_type).toBe("applications");
    expect((insert?.payload as any).linked_record_id).toBe("app-9");
    expect((insert?.payload as any).form_type).toBe("application_fee");
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.metadata.payment_type).toBe("application_fee");
    expect(arg.metadata.application_id).toBe("app-9");
  });

  it("falls back to the member profile when no payment form is posted", async () => {
    serverClient = fakeProfileClient({
      user: { id: "member-1", email: "jamie@example.com" },
      profile: { stripe_customer_id: null, first_name: "Jamie", last_name: "Counselor", email: "jamie@example.com", phone: "480-555-1212" },
    });
    const res = await POST(req({ slug: "initial-cert", paymentForm: null }));
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalled();
  });

  it("rejects a checkout without a payment form when the profile is incomplete", async () => {
    const res = await POST(req({ slug: "initial-cert", paymentForm: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "payment_form_required" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("uses the requested month quantity for certification sync", async () => {
    getProductBySlug.mockReturnValue({
      ...PRODUCT,
      slug: "certification-sync",
      name: "Certification Sync",
      category: "Service",
    });
    const res = await POST(req({ slug: "certification-sync", quantity: 6 }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items).toEqual([{ price: "price_123", quantity: 6 }]);
    expect(arg.metadata.sync_months).toBe("6");
  });

  it("does not accept quantity overrides for other products", async () => {
    const res = await POST(req({ slug: "initial-cert", quantity: 6 }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(arg.metadata.sync_months).toBe("");
  });

  it("attributes to a signed-in member and reuses an existing customer id", async () => {
    serverClient = fakeProfileClient({
      user: { id: "user-1", email: "m@example.com" },
      profile: { stripe_customer_id: "cus_existing" },
    });
    const res = await POST(req({ slug: "initial-cert", credentialLevel: "CACI", examMode: "remote" }));
    expect(res.status).toBe(200);

    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.customer).toBe("cus_existing");
    expect(arg.customer_email).toBeUndefined();
    expect(arg.client_reference_id).toBe("user-1");
    expect(arg.metadata.member_id).toBe("user-1");
    expect(arg.metadata.credential_level).toBe("CACI");
    expect(arg.metadata.exam_mode).toBe("remote");
  });

  it("falls back to customer_email for a member without a stored customer id", async () => {
    serverClient = fakeProfileClient({
      user: { id: "user-2", email: "m2@example.com" },
      profile: { stripe_customer_id: null },
    });
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.customer).toBeUndefined();
    expect(arg.customer_email).toBe("jamie@example.com");
    expect(arg.client_reference_id).toBe("user-2");
  });

  it("forwards reciprocity metadata markers", async () => {
    serverClient = fakeProfileClient({
      user: { id: "user-1", email: "m@example.com" },
      profile: { stripe_customer_id: null, first_name: "Morgan", last_name: "Lee", email: "m@example.com", phone: "4805551212" } as any,
      reciprocityRequest: { id: "rr-9", member_id: "user-1", direction: "out_of_az", credential: "CADAC", destination: "Nevada", status: "submitted", payment_status: "pending" },
    });
    const res = await POST(req({ slug: "initial-cert", reciprocityRequestId: "rr-9" }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.metadata.reciprocity_request_id).toBe("rr-9");
    expect(arg.metadata.payment_type).toBe("reciprocity");
  });

  it("builds an authenticated testing workflow checkout with certification add-on", async () => {
    serverClient = fakeProfileClient({
      user: { id: "user-test", email: "tester@example.com" },
      profile: { stripe_customer_id: null },
      testingRequest: { id: "tr-1", member_id: "user-test", exam_code: "ADC", testing_mode: "remote", seeks_abcac_credential: true, credential_level: "CAC", status: "awaiting_payment", purchaser_first_name: "Jamie", purchaser_last_name: "Counselor", purchaser_email: "jamie@example.com", purchaser_phone: "4805551212", tester_first_name: "Taylor", tester_last_name: "Tester", tester_email: "tester@example.com" },
    });
    getProductBySlug.mockReturnValue({ ...PRODUCT, slug: "testing-for-licensure-with-azbbhe-remote-proctored-exam", name: "Remote testing", category: "Testing" });
    getPriceId.mockImplementation((slug: string) => slug.includes("certification-only") ? "price_cert" : "price_test");
    const res = await POST(req({ testingRequestId: "tr-1" }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.line_items).toEqual([{ price: "price_test", quantity: 1 }, { price: "price_cert", quantity: 1 }]);
    expect(arg.cancel_url).toBe("http://localhost:3000/account/testing");
    expect(arg.metadata).toMatchObject({ payment_type: "testing", testing_request_id: "tr-1", exam_code: "ADC", credential_level: "CAC", exam_mode: "remote", member_id: "user-test" });
  });

  it("coerces caller-supplied metadata to strings", async () => {
    const res = await POST(req({ slug: "initial-cert", metadata: { qty: 3, flag: true, skip: null } }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.metadata.qty).toBe("3");
    expect(arg.metadata.flag).toBe("true");
    expect("skip" in arg.metadata).toBe(false);
  });

  it("returns 500 checkout_failed when Stripe throws", async () => {
    sessionsCreate.mockRejectedValue(new Error("stripe down"));
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "checkout_failed" });
  });
});
