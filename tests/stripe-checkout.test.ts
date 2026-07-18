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

// Supabase server client — by default, a guest (no user).
let serverClient: unknown;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverClient,
}));

import { POST } from "@/app/api/stripe/checkout/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// A chainable supabase builder whose terminal methods resolve to { data }.
function fakeProfileClient(opts: {
  user: { id: string; email?: string } | null;
  profile?: { stripe_customer_id?: string | null } | null;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from() {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = async () => ({ data: opts.profile ?? null });
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
  serverClient = fakeProfileClient({ user: null });
  getProductBySlug.mockReturnValue(PRODUCT);
  getPriceId.mockReturnValue("price_123");
  sessionsCreate.mockResolvedValue({ url: "https://stripe.test/session" });
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

  it("builds a guest session with the right price and urls", async () => {
    const res = await POST(req({ slug: "initial-cert" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://stripe.test/session" });

    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(arg.success_url).toContain("/checkout/success?session_id={CHECKOUT_SESSION_ID}");
    expect(arg.cancel_url).toContain("/checkout/cancel");
    // No user -> no customer / customer_email / client_reference_id.
    expect(arg.customer).toBeUndefined();
    expect(arg.customer_email).toBeUndefined();
    expect(arg.client_reference_id).toBeUndefined();
    expect(arg.metadata.slug).toBe("initial-cert");
    expect(arg.metadata.member_id).toBe("");
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
    expect(arg.customer_email).toBe("m2@example.com");
    expect(arg.client_reference_id).toBe("user-2");
  });

  it("forwards reciprocity metadata markers", async () => {
    const res = await POST(req({ slug: "initial-cert", reciprocityRequestId: "rr-9" }));
    expect(res.status).toBe(200);
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.metadata.reciprocity_request_id).toBe("rr-9");
    expect(arg.metadata.payment_type).toBe("reciprocity");
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
