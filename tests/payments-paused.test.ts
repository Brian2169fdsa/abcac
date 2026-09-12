import { describe, it, expect, vi } from "vitest";

// With NEXT_PUBLIC_PAYMENTS_ENABLED=false both checkout routes refuse to start a
// Stripe session before touching auth, Stripe, or the database.
vi.mock("@/lib/feature-flags", () => ({
  paymentsEnabled: false,
  agentWorkspaceEnabled: true,
  adminReportsDashboardEnabled: true,
  PAYMENTS_PAUSED_TITLE: "Online payment opens shortly",
  PAYMENTS_PAUSED_BODY: "paused",
}));
vi.mock("@/lib/stripe", () => ({ isStripeConfigured: true, stripe: {} }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => {
    throw new Error("must not be called while payments are paused");
  },
  createSupabaseAdminClient: () => {
    throw new Error("must not be called while payments are paused");
  },
}));

import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as invoiceCheckout } from "@/app/api/stripe/invoice-checkout/route";

function req(body: unknown) {
  return new Request("http://localhost/api/stripe/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("payments paused flag", () => {
  it("checkout returns 503 payments_paused", async () => {
    const res = await checkout(req({ slug: "printed-certificate-copy" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments_paused" });
  });

  it("invoice checkout returns 503 payments_paused", async () => {
    const res = await invoiceCheckout(req({ invoice_id: "inv-1" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments_paused" });
  });
});
