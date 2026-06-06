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

  // Idempotency: ignore an event id we've already processed.
  try {
    const { data: seen } = await admin
      .from("payments")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (seen) return NextResponse.json({ received: true, duplicate: true });
  } catch {
    // payments table may not exist — log dependency, continue best-effort.
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(admin, event);
    } else if (event.type === "invoice.paid") {
      await handleInvoicePaid(admin, event);
    }
  } catch (err) {
    console.error("webhook side-effect error", err);
    // Still 200 so Stripe doesn't retry forever on a backend-schema gap.
  }

  return NextResponse.json({ received: true });
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function handleCheckoutCompleted(admin: Admin, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const memberId = session.client_reference_id || meta.member_id || null;

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

  await applyCredentialSideEffect(admin, memberId, meta.slug ?? "", meta.credential_level || null);
}

async function handleInvoicePaid(admin: Admin, event: Stripe.Event) {
  // Recurring subscription renewal. Record the payment; extend on the slug if known.
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.billing_reason === "subscription_create") return; // already handled by checkout.session.completed
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
  if (error) console.error("payments insert failed (backend dependency?):", error.message);
}

async function applyCredentialSideEffect(
  admin: Admin,
  memberId: string | null,
  slug: string,
  level: string | null,
) {
  if (!memberId) return; // guest checkout — reconcile by email later (logged dependency)

  const renewSlugs = [
    "certification-renewal-2-year-credential-renewal-fee",
    "initial-certification-full-application-exam-fee",
    "initial-certification-full-application-exam-fee-remote-proctored-exam",
    "certification-certification-only-fee-already-passed-icrc-exam",
  ];

  try {
    if (renewSlugs.includes(slug)) {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 2);
      const patch = { status: "active", expires_at: expires.toISOString() };
      const q = admin.from("credentials").update(patch).eq("member_id", memberId);
      await (level ? q.eq("level", level) : q);
    } else if (slug === "certification-sync") {
      await admin.from("credentials").update({ sync_enabled: true }).eq("member_id", memberId);
    }
  } catch (err) {
    console.error("credential side-effect skipped (backend dependency?):", err);
  }
}
