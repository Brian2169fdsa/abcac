import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";

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

  // If this checkout was paying an IC&RC reciprocity OUT transfer fee ($150),
  // flip the reciprocity_requests row to paid and record the session id. The
  // update is idempotent — re-running it just re-sets the same values, and the
  // event-level idempotency guard above already prevents duplicate processing.
  if (meta.payment_type === "reciprocity" && meta.reciprocity_request_id) {
    try {
      await admin.from("reciprocity_requests").update({
        payment_status: "paid",
        stripe_session_id: session.id,
      }).eq("id", meta.reciprocity_request_id);
    } catch (err) {
      console.error("reciprocity mark-paid skipped:", err);
    }
  }

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

  // Best-effort receipt email — never throws, never affects the 200 response.
  if (memberId) {
    try {
      const { data: member } = await admin
        .from("profiles")
        .select("email,first_name")
        .eq("id", memberId)
        .maybeSingle();

      if (member?.email) {
        const amountDollars =
          session.amount_total != null
            ? `$${(session.amount_total / 100).toFixed(2)}`
            : "an amount";
        const productName = meta.product_name || "your purchase";
        const greeting = member.first_name ? `Hi ${member.first_name},` : "Hi,";

        const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">ABCAC Payment Receipt</h2>
  <p>${greeting}</p>
  <p>This email confirms that we have received your payment for <strong>${productName}</strong>.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Product</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${productName}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#6b7280">Amount paid</td>
      <td style="padding:8px 0;text-align:right"><strong>${amountDollars}</strong></td>
    </tr>
  </table>
  <p style="color:#6b7280;font-size:14px">If you have any questions about your payment, please contact us at <a href="mailto:info@abcac.org">info@abcac.org</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${siteConfig.shortName} &mdash; ${siteConfig.name}</p>
</div>`.trim();

        await sendEmail({
          to: member.email,
          subject: "Your ABCAC payment receipt",
          html,
        });
      }
    } catch (err) {
      console.error("receipt email skipped:", err);
    }
  }

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
