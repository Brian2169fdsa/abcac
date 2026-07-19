import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Creates a Stripe Checkout Session to pay an admin-issued invoice.
export async function POST(req: Request) {
  if (!isStripeConfigured) return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });

  let parsed: { invoice_id?: string };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { invoice_id } = parsed;
  if (!invoice_id || typeof invoice_id !== "string") {
    return NextResponse.json({ error: "missing invoice_id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Read the invoice with the service role and confirm ownership server-side.
  const admin = createSupabaseAdminClient();
  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoice_id).single();
  if (!invoice) return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  if (invoice.member_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (invoice.status === "paid") return NextResponse.json({ error: "already_paid" }, { status: 409 });

  const firstName = String(user.user_metadata?.first_name || user.user_metadata?.given_name || "Member").trim();
  const lastName = String(user.user_metadata?.last_name || user.user_metadata?.family_name || "Account holder").trim();
  const payerEmail = user.email || String(user.user_metadata?.email || "").trim();
  const payerPhone = String(user.phone || user.user_metadata?.phone || "Not provided").trim();
  if (!payerEmail) return NextResponse.json({ error: "payment_profile_incomplete" }, { status: 400 });

  const { data: paymentSubmission, error: submissionError } = await admin.from("payment_submissions").insert({
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
  }).select("id").single();
  if (submissionError || !paymentSubmission?.id) {
    return NextResponse.json({ error: "payment_form_save_failed" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: invoice.currency ?? "usd",
          unit_amount: invoice.amount_cents,
          product_data: { name: invoice.description, description: `Invoice ${invoice.invoice_number}` },
        },
      }],
      customer_email: payerEmail,
      client_reference_id: user.id,
      metadata: {
        invoice_id: invoice.id,
        member_id: user.id,
        product_name: invoice.description,
        slug: "invoice",
        payment_submission_id: paymentSubmission.id,
        form_type: "invoice",
        linked_record_type: "invoices",
        linked_record_id: invoice.id,
      },
      success_url: `${siteUrl}/account/invoices?paid=1`,
      cancel_url: `${siteUrl}/account/invoices`,
    });
    await admin.from("payment_submissions").update({ status: "checkout_created", stripe_session_id: session.id }).eq("id", paymentSubmission.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("invoice checkout error", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
