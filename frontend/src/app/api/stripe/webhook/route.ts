import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Stripe requires the raw request body to verify the signature.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeConfigured || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `invalid signature: ${String(err)}` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotency: ignore an event id we've already recorded.
  try {
    const { data: seen } = await admin
      .from("payments")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (seen) return NextResponse.json({ received: true, duplicate: true });
  } catch {
    // payments table not present — should not happen after migration 004.
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(admin, event);
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(admin, event);
    }
  } catch (err) {
    console.error("webhook side-effect error", err);
    // Still 200 so Stripe doesn't retry forever; the payment row is the record.
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function handleCheckoutCompleted(admin: Admin, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const memberId = session.client_reference_id || meta.member_id || null;

  // If this checkout was paying an admin-issued invoice, mark it paid.
  if (meta.invoice_id) {
    try {
      await admin.from("invoices").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: String(session.payment_intent ?? ""),
      }).eq("id", meta.invoice_id);
    } catch (err) {
      console.error("invoice mark-paid skipped:", err);
    }
  }

  await writePayment(admin, {
    member_id: memberId,
    stripe_session_id: session.id,
    stripe_event_id: event.id,
    slug: meta.slug ?? "",
    product_name: meta.product_name ?? "",
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    mode: session.mode === "subscription" ? "subscription" : "payment",
    credential_level: meta.credential_level || null,
    exam_mode: meta.exam_mode || null,
    status: "paid",
  });

  // Persist the Stripe customer id on the profile so future checkouts and portal
  // lookups can use it directly (avoids the email-based customer list search).
  if (session.customer && memberId) {
    try {
      await admin
        .from("profiles")
        .update({ stripe_customer_id: String(session.customer) })
        .eq("id", memberId);
    } catch (err) {
      console.error("stripe_customer_id persist skipped:", err);
    }
  }

  // The ONLY automatic credential effect on payment is enabling Certification
  // Sync. Initial certification and renewals are issued by ABCAC staff AFTER
  // reviewing the member's application/CEU documentation in the admin console —
  // paying a fee does not by itself grant or renew a credential.
  if (meta.slug === "certification-sync" && memberId) {
    try {
      await admin.from("certifications").update({ sync_enabled: true }).eq("member_id", memberId);
    } catch (err) {
      console.error("sync flag update skipped:", err);
    }
  }
}

async function handleInvoicePaid(admin: Admin, event: Stripe.Event) {
  // Recurring subscription renewal (Certification Sync, annual provider fee).
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.billing_reason === "subscription_create") return; // first invoice handled by checkout.session.completed
  await writePayment(admin, {
    member_id: null,
    stripe_session_id: (invoice.id as string) ?? "",
    stripe_event_id: event.id,
    slug: "",
    product_name: invoice.lines.data[0]?.description ?? "Subscription renewal",
    amount_cents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    mode: "subscription",
    credential_level: null,
    exam_mode: null,
    status: "paid",
  });
}

interface PaymentRow {
  member_id: string | null;
  stripe_session_id: string;
  stripe_event_id: string;
  slug: string;
  product_name: string;
  amount_cents: number;
  currency: string;
  mode: "payment" | "subscription";
  credential_level: string | null;
  exam_mode: string | null;
  status: string;
}

async function writePayment(admin: Admin, row: PaymentRow) {
  const { error } = await admin.from("payments").insert(row);
  if (error) console.error("payments insert failed:", error.message);
}
