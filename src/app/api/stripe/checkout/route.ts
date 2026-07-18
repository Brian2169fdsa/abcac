import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProductBySlug, getPriceId } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }

  let parsed: {
    slug?: string;
    credentialLevel?: string;
    examMode?: string;
    quantity?: number;
    reciprocityRequestId?: string;
    // Optional free-form metadata to forward onto the Checkout session. Values
    // are coerced to strings (Stripe metadata is string→string). Backward
    // compatible: callers that don't send it behave exactly as before.
    metadata?: Record<string, unknown>;
  };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { slug, credentialLevel, examMode, quantity, reciprocityRequestId, metadata: extraMetadata } = parsed;
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }
  const product = getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const checkoutQuantity = slug === "certification-sync"
    ? Number.isInteger(quantity) && quantity! >= 1 && quantity! <= 120
      ? quantity!
      : 1
    : 1;

  const priceId = getPriceId(slug);
  if (!priceId) {
    // Seed script hasn't run yet for this slug.
    return NextResponse.json({ error: "price_not_found" }, { status: 503 });
  }

  // Attribute to the signed-in member if there is one (guest checkout allowed).
  // member_id is the Supabase auth user id, which equals profiles.id in the
  // shared portal schema — no separate members table.
  let memberId: string | null = null;
  let email: string | undefined;
  let existingStripeCustomerId: string | null = null;
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? undefined;
      memberId = user.id;
      // Re-use an existing Stripe customer when available so the member's
      // payment history stays consolidated in Stripe and the portal works
      // without an email-based lookup.
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      existingStripeCustomerId = profile?.stripe_customer_id ?? null;
    }
  } catch {
    // not signed in — proceed as guest (reconcile by email later).
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Forward any caller-supplied metadata (coerced to strings) plus a normalized
  // reciprocity marker. The webhook keys off `payment_type` + `reciprocity_request_id`
  // to reconcile the $150 IC&RC OUT transfer fee.
  const forwardedMetadata: Record<string, string> = {};
  if (extraMetadata && typeof extraMetadata === "object") {
    for (const [k, v] of Object.entries(extraMetadata)) {
      if (v == null) continue;
      forwardedMetadata[k] = String(v);
    }
  }
  if (typeof reciprocityRequestId === "string" && reciprocityRequestId) {
    forwardedMetadata.reciprocity_request_id = reciprocityRequestId;
    forwardedMetadata.payment_type = "reciprocity";
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: [{ price: priceId, quantity: checkoutQuantity }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      // Prefer an existing customer id; fall back to customer_email for guests
      // or first-time purchasers whose id hasn't been stored yet.
      ...(existingStripeCustomerId
        ? { customer: existingStripeCustomerId }
        : email
          ? { customer_email: email }
          : {}),
      ...(memberId ? { client_reference_id: memberId } : {}),
      metadata: {
        slug: product.slug,
        product_name: product.name,
        credential_level: credentialLevel ?? "",
        exam_mode: examMode ?? "",
        sync_months: slug === "certification-sync" ? String(checkoutQuantity) : "",
        member_id: memberId ?? "",
        ceu_note: product.category === "CEU Endorsement" ? "Submit materials to abcac@abcac.org (4-week review)" : "",
        // Caller-supplied + reciprocity markers last so they can't clobber the
        // reserved keys above unless intentionally provided.
        ...forwardedMetadata,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
