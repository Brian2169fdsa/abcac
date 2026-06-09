import { describe, it, expect, vi, beforeEach } from "vitest";

const customersList = vi.fn();
const portalCreate = vi.fn();
let stripeConfigured = true;

vi.mock("@/lib/stripe", () => ({
  get isStripeConfigured() {
    return stripeConfigured;
  },
  stripe: {
    customers: { list: (...a: unknown[]) => customersList(...a) },
    billingPortal: { sessions: { create: (...a: unknown[]) => portalCreate(...a) } },
  },
}));

let serverClient: unknown;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverClient,
}));

import { GET } from "@/app/api/stripe/portal/route";

function req(): Request {
  return new Request("http://localhost/api/stripe/portal", { method: "GET" });
}

function fakeClient(opts: {
  user: { id: string; email?: string | null } | null;
  profile?: { stripe_customer_id?: string | null } | null;
}) {
  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from() {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => ({ data: opts.profile ?? null });
      return b;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeConfigured = true;
  serverClient = fakeClient({ user: { id: "u1", email: "m@example.com" }, profile: { stripe_customer_id: "cus_1" } });
  customersList.mockResolvedValue({ data: [] });
  portalCreate.mockResolvedValue({ url: "https://stripe.test/portal" });
});

describe("GET /api/stripe/portal", () => {
  it("redirects to /account when Stripe is not configured", async () => {
    stripeConfigured = false;
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/account$/);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no authed user/email", async () => {
    serverClient = fakeClient({ user: null });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=/account");
  });

  it("redirects to the portal url using the stored customer id", async () => {
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://stripe.test/portal");
    expect(portalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" }),
    );
    // Stored id present -> no email-based lookup needed.
    expect(customersList).not.toHaveBeenCalled();
  });

  it("falls back to an email lookup when no stored customer id", async () => {
    serverClient = fakeClient({ user: { id: "u1", email: "m@example.com" }, profile: { stripe_customer_id: null } });
    customersList.mockResolvedValue({ data: [{ id: "cus_email" }] });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(customersList).toHaveBeenCalledWith({ email: "m@example.com", limit: 1 });
    expect(portalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_email" }),
    );
  });

  it("redirects to /account when no customer can be found anywhere", async () => {
    serverClient = fakeClient({ user: { id: "u1", email: "m@example.com" }, profile: { stripe_customer_id: null } });
    customersList.mockResolvedValue({ data: [] });
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/account$/);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("redirects to /account when Stripe throws", async () => {
    portalCreate.mockRejectedValue(new Error("stripe down"));
    const res = await GET(req());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/account$/);
  });
});
