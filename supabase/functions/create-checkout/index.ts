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

    const firstName = String(user.user_metadata?.first_name ?? user.user_metadata?.given_name ?? "Member");
    const lastName = String(user.user_metadata?.last_name ?? user.user_metadata?.family_name ?? "Account holder");
    const payerEmail = user.email ?? String(user.user_metadata?.email ?? "");
    const payerPhone = String(user.phone ?? user.user_metadata?.phone ?? "Not provided");
    if (!payerEmail) return json({ error: "payment_profile_incomplete" }, 400);

    const { data: paymentSubmission, error: submissionError } = await admin
      .from("payment_submissions")
      .insert({
        member_id: user.id,
        form_type: "invoice",
        linked_record_type: "invoices",
        linked_record_id: invoice.id,
        product_slug: "invoice",
        product_name: invoice.description,
        payer_first_name: firstName,
        payer_last_name: lastName,
        payer_email: payerEmail,
        payer_phone: payerPhone,
        reference_number: invoice.invoice_number,
        form_payload: { invoiceNumber: invoice.invoice_number, description: invoice.description },
      })
      .select("id")
      .single();
    if (submissionError || !paymentSubmission?.id) return json({ error: "payment_form_save_failed" }, 500);

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
      customer_email: payerEmail,
      client_reference_id: user.id,
      metadata: {
        invoice_id: invoice.id,
        member_id: invoice.member_id,
        product_name: invoice.description,
        slug: "invoice",
        payment_submission_id: paymentSubmission.id,
        form_type: "invoice",
        linked_record_type: "invoices",
        linked_record_id: invoice.id,
      },
      success_url: base + "/?payment=success",
      cancel_url: base + "/?payment=cancelled",
    });

    await admin.from("payment_submissions").update({
      status: "checkout_created",
      stripe_session_id: session.id,
    }).eq("id", paymentSubmission.id);

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
