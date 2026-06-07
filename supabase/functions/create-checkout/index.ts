// ABCAC — create-checkout Edge Function
// Creates a Stripe Checkout Session for an unpaid invoice and returns the URL.
// Runs server-side with the service-role key; the Stripe secret never touches
// the browser. The member is authenticated and must own the invoice.
//
// Deploy:
//   supabase functions deploy create-checkout
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
//
// If STRIPE_SECRET_KEY is not set, returns { error: "payments_not_configured" }
// so the portal can show a friendly "contact ABCAC" message instead of failing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) return json({ error: "payments_not_configured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { invoice_id, origin } = await req.json();
    if (!invoice_id) return json({ error: "missing invoice_id" }, 400);

    // Service-role read so we can trust the amount, and confirm ownership.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: invoice } = await admin
      .from("invoices").select("*").eq("id", invoice_id).single();

    if (!invoice) return json({ error: "invoice not found" }, 404);
    if (invoice.member_id !== user.id) return json({ error: "forbidden" }, 403);
    if (invoice.status === "paid") return json({ error: "already_paid" }, 409);

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const base = origin ?? Deno.env.get("VERCEL_URL") ?? "https://portal.abcac.org";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: invoice.amount_cents,
          product_data: {
            name: invoice.description,
            description: "Invoice " + invoice.invoice_number,
          },
        },
      }],
      customer_email: user.email,
      metadata: { invoice_id: invoice.id, member_id: invoice.member_id },
      success_url: base + "/?payment=success",
      cancel_url: base + "/?payment=cancelled",
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
