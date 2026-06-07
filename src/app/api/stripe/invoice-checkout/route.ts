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
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { invoice_id: invoice.id, member_id: user.id, product_name: invoice.description, slug: "invoice" },
      success_url: `${siteUrl}/account/invoices?paid=1`,
      cancel_url: `${siteUrl}/account/invoices`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("invoice checkout error", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
