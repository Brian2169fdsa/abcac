import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProductBySlug, getPriceId } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "payments_not_configured" });
  }

  const { slug, credentialLevel, examMode } = await req.json();
  const product = getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const priceId = getPriceId(slug);
  if (!priceId) {
    // Seed script hasn't run yet for this slug.
    return NextResponse.json({ error: "price_not_found" });
  }

  // Attribute to the signed-in member if there is one (guest checkout allowed).
  // member_id is the Supabase auth user id, which equals profiles.id in the
  // shared portal schema — no separate members table.
  let memberId: string | null = null;
  let email: string | undefined;
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? undefined;
      memberId = user.id;
    }
  } catch {
    // not signed in — proceed as guest (reconcile by email later).
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      ...(email ? { customer_email: email } : {}),
      ...(memberId ? { client_reference_id: memberId } : {}),
      metadata: {
        slug: product.slug,
        product_name: product.name,
        credential_level: credentialLevel ?? "",
        exam_mode: examMode ?? "",
        member_id: memberId ?? "",
        ceu_note: product.category === "CEU Endorsement" ? "Submit materials to abcac@abcac.org (4-week review)" : "",
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
