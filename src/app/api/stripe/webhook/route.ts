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
  const paymentSubmission = await markPaymentSubmissionPaid(admin, meta.payment_submission_id, {
    stripeSessionId: session.id,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });

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

  if (meta.payment_type === "testing" && meta.testing_request_id && memberId) {
    try {
      const now = new Date().toISOString();
      await admin.from("testing_requests").update({
        payment_status: "paid",
        status: "paid",
        paid_at: now,
        stripe_session_id: session.id,
      }).eq("id", meta.testing_request_id).eq("member_id", memberId).eq("status", "awaiting_payment");
      await admin.from("member_tasks").insert({
        member_id: memberId,
        title: `Pre-register ${meta.exam_code || "IC&RC"} exam candidate with SMT`,
        detail: `Payment received. Review testing request ${meta.testing_request_id}, complete SMT pre-registration, then mark the request complete.`,
        status: "open",
        priority: "high",
        visible_to_member: false,
      });
      await admin.from("notifications").insert({
        member_id: memberId,
        category: "application",
        title: "Exam registration payment received",
        body: "ABCAC received your payment and your request is ready for staff pre-registration with SMT.",
        link: "/account/testing",
      });
    } catch (err) {
      console.error("testing request payment reconciliation skipped:", err);
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
    payment_submission_id: meta.payment_submission_id || null,
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
  await sendPaymentEmails(admin, {
    memberId,
    paymentSubmission,
    productName: meta.product_name || "ABCAC payment",
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    stripeReference: session.id,
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

  // Application-packet fee (initial cert, renewal, CEU workshop): advance the
  // linked application into the review queue so admin sees it as fee-paid.
  if (meta.payment_type === "application_fee" && memberId && meta.application_id) {
    try {
      await admin.from("applications").update({ status: "under_review" })
        .eq("id", meta.application_id)
        .eq("member_id", memberId)
        .eq("status", "submitted");
      await admin.from("notifications").insert({
        member_id: memberId,
        category: "application",
        title: "Application fee received",
        body: "ABCAC received your application fee. Your packet is now in the review queue.",
        link: "/account/applications",
      });
    } catch (err) {
      console.error("application fee reconciliation skipped:", err);
    }
  }

  // Certification Sync payment advances the linked request to the review queue.
  // It does NOT change credential dates or enable sync by itself; ABCAC staff (or
  // the guarded automation workflow, when explicitly enabled) completes review.
  if (meta.slug === "certification-sync" && memberId && meta.sync_application_id) {
    try {
      await admin.from("applications").update({ status: "under_review" })
        .eq("id", meta.sync_application_id)
        .eq("member_id", memberId)
        .eq("app_type", "cert_sync")
        .eq("status", "submitted");
      await admin.from("member_tasks").update({
        detail: `Certification Sync payment received. Application ${meta.sync_application_id}; Stripe session ${session.id}. Review credential dates before approval.`,
      }).eq("member_id", memberId).eq("title", "Review certification sync request").eq("status", "open");
    } catch (err) {
      console.error("sync request payment reconciliation skipped:", err);
    }
  }
}

async function handleInvoicePaid(admin: Admin, event: Stripe.Event) {
  // Recurring subscription renewal (for example, an annual provider fee).
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.billing_reason === "subscription_create") return; // first invoice handled by checkout.session.completed

  // Attribute the renewal to a member by resolving the Stripe customer id back to
  // a profile (persisted on checkout.session.completed). If it can't be resolved,
  // fall back to null rather than crashing.
  let memberId: string | null = null;
  if (invoice.customer) {
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", String(invoice.customer))
        .maybeSingle();
      memberId = profile?.id ?? null;
    } catch (err) {
      console.error("invoice member resolve skipped:", err);
    }
  }

  const invoiceWithMetadata = invoice as Stripe.Invoice & {
    subscription_details?: { metadata?: Record<string, string> | null } | null;
    parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null;
  };
  const meta = invoiceWithMetadata.subscription_details?.metadata
    ?? invoiceWithMetadata.parent?.subscription_details?.metadata
    ?? {};
  const paymentSubmission = meta.payment_submission_id
    ? await getPaymentSubmission(admin, meta.payment_submission_id)
    : null;
  const productName = meta.product_name || invoice.lines.data[0]?.description || "Subscription renewal";

  await writePayment(admin, {
    member_id: memberId,
    payment_submission_id: meta.payment_submission_id || null,
    stripe_session_id: (invoice.id as string) ?? "",
    stripe_event_id: event.id,
    slug: "",
    product_name: productName,
    amount_cents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    mode: "subscription",
    credential_level: null,
    exam_mode: null,
    status: "paid",
  });
  await sendPaymentEmails(admin, {
    memberId,
    paymentSubmission,
    productName,
    amountCents: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    stripeReference: String(invoice.id),
  });
}

interface PaymentRow {
  member_id: string | null;
  payment_submission_id: string | null;
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

interface PaymentSubmission {
  id: string;
  form_type: string;
  linked_record_type: string | null;
  linked_record_id: string | null;
  payer_first_name: string;
  payer_last_name: string;
  payer_email: string;
  payer_phone: string;
  reference_number: string | null;
  notes: string | null;
}

async function getPaymentSubmission(admin: Admin, id?: string | null): Promise<PaymentSubmission | null> {
  if (!id) return null;
  try {
    const { data } = await admin.from("payment_submissions")
      .select("id,form_type,linked_record_type,linked_record_id,payer_first_name,payer_last_name,payer_email,payer_phone,reference_number,notes")
      .eq("id", id)
      .maybeSingle();
    return (data as PaymentSubmission | null) ?? null;
  } catch (err) {
    console.error("payment submission lookup skipped:", err);
    return null;
  }
}

async function markPaymentSubmissionPaid(
  admin: Admin,
  id: string | undefined,
  payment: { stripeSessionId: string; amountCents: number; currency: string },
): Promise<PaymentSubmission | null> {
  if (!id) return null;
  try {
    await admin.from("payment_submissions").update({
      status: "paid",
      stripe_session_id: payment.stripeSessionId,
      amount_cents: payment.amountCents,
      currency: payment.currency,
      paid_at: new Date().toISOString(),
    }).eq("id", id);
  } catch (err) {
    console.error("payment submission reconciliation skipped:", err);
  }
  return getPaymentSubmission(admin, id);
}

async function sendPaymentEmails(
  admin: Admin,
  payment: {
    memberId: string | null;
    paymentSubmission: PaymentSubmission | null;
    productName: string;
    amountCents: number;
    currency: string;
    stripeReference: string;
  },
) {
  let member: { email?: string | null; first_name?: string | null } | null = null;
  if (payment.memberId) {
    try {
      const { data } = await admin.from("profiles").select("email,first_name").eq("id", payment.memberId).maybeSingle();
      member = data;
    } catch (err) {
      console.error("payment member lookup skipped:", err);
    }
  }

  const payerEmail = payment.paymentSubmission?.payer_email || member?.email || null;
  const payerFirstName = payment.paymentSubmission?.payer_first_name || member?.first_name || "";
  const productName = escapeHtml(payment.productName);
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.toUpperCase() }).format(payment.amountCents / 100);

  if (payerEmail) {
    const receiptHtml = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#861f24">ABCAC Payment Receipt</h2>
  <p>${payerFirstName ? `Hi ${escapeHtml(payerFirstName)},` : "Hi,"}</p>
  <p>We received your payment for <strong>${productName}</strong>. Your submitted payment form is attached to this transaction for ABCAC staff processing.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Product</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right">${productName}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Amount paid</td><td style="padding:8px 0;text-align:right"><strong>${escapeHtml(amount)}</strong></td></tr>
  </table>
  <p style="color:#6b7280;font-size:14px">Questions? Contact <a href="${siteConfig.contact.emailHref}">${siteConfig.contact.email}</a> or ${siteConfig.contact.phone}.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${siteConfig.shortName} &mdash; ${siteConfig.name}</p>
</div>`.trim();
    await sendEmail({ to: payerEmail, subject: "Your ABCAC payment receipt", html: receiptHtml });
  }

  const submission = payment.paymentSubmission;
  const adminHtml = `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#111">
  <h2 style="color:#861f24">ABCAC payment received</h2>
  <p>A Stripe payment was completed and ${submission ? "its form is ready in the Finance dashboard" : "no attached form record was found"}.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Payer</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(submission ? `${submission.payer_first_name} ${submission.payer_last_name}` : payerEmail || "Unknown")}</td></tr>
    <tr><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Product</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right">${productName}</td></tr>
    <tr><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Amount</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${escapeHtml(amount)}</strong></td></tr>
    <tr><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Form type</td><td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(submission?.form_type || "Missing")}</td></tr>
    <tr><td style="padding:7px 0;color:#6b7280">Stripe reference</td><td style="padding:7px 0;text-align:right">${escapeHtml(payment.stripeReference)}</td></tr>
  </table>
  <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")}/admin/finance">Open the Finance dashboard</a></p>
</div>`.trim();
  await sendEmail({
    to: siteConfig.contact.email,
    subject: `Payment received: ${payment.productName} — ${amount}`,
    html: adminHtml,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
