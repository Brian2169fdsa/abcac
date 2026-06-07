// ABCAC — stripe-webhook Edge Function
// Receives Stripe events and marks invoices paid when checkout completes.
// This is the source of truth for payment status (never trust the browser
// redirect alone).
//
// Deploy (must be public — Stripe calls it, no Supabase auth):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
// Then add the function URL as a webhook endpoint in the Stripe dashboard,
// subscribed to the "checkout.session.completed" event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
      return new Response("payments_not_configured", { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature!, WEBHOOK_SECRET);
    } catch (err) {
      return new Response("invalid signature: " + String(err), { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // Idempotency guard: if a payments row for this stripe event already
        // exists we've already processed it — return early to avoid double
        // side-effects if both webhooks (Edge Function + Next.js route) are
        // ever registered at the same time.
        try {
          const { data: seen } = await admin
            .from("payments")
            .select("id")
            .eq("stripe_event_id", event.id)
            .maybeSingle();
          if (seen) {
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch {
          // payments table not present — proceed without the guard.
        }

        await admin.from("invoices").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent: String(session.payment_intent ?? ""),
        }).eq("id", invoiceId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});
