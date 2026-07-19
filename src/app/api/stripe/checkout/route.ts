import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProductBySlug, getPriceId } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TESTING_PRODUCT_BY_MODE, isTestingMode } from "@/lib/testing-requests";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured) return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });

  let parsed: {
    slug?: string;
    credentialLevel?: string;
    examMode?: string;
    quantity?: number;
    reciprocityRequestId?: string;
    testingRequestId?: string;
    metadata?: Record<string, unknown>;
  };
  try { parsed = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const supabase = createSupabaseServerClient();
  let memberId: string | null = null;
  let email: string | undefined;
  let existingStripeCustomerId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      memberId = user.id;
      email = user.email ?? undefined;
      const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
      existingStripeCustomerId = profile?.stripe_customer_id ?? null;
    }
  } catch { /* guest checkout remains available for non-workflow products */ }

  let slug = parsed.slug;
  let credentialLevel = parsed.credentialLevel;
  let examMode = parsed.examMode;
  let testingRequest: any = null;

  if (parsed.testingRequestId) {
    if (!memberId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    const { data } = await supabase.from("testing_requests")
      .select("id,member_id,exam_code,testing_mode,seeks_abcac_credential,credential_level,status")
      .eq("id", parsed.testingRequestId).eq("member_id", memberId).maybeSingle();
    if (!data) return NextResponse.json({ error: "testing_request_not_found" }, { status: 404 });
    if (data.status !== "awaiting_payment") return NextResponse.json({ error: "testing_request_not_payable" }, { status: 409 });
    if (!isTestingMode(data.testing_mode)) return NextResponse.json({ error: "invalid_testing_mode" }, { status: 400 });
    testingRequest = data;
    slug = TESTING_PRODUCT_BY_MODE[data.testing_mode];
    credentialLevel = data.credential_level ?? data.exam_code;
    examMode = data.testing_mode;
  }

  if (typeof slug !== "string" || !slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  const product = getProductBySlug(slug);
  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  const priceId = getPriceId(slug);
  if (!priceId) return NextResponse.json({ error: "price_not_found" }, { status: 503 });

  const checkoutQuantity = slug === "certification-sync"
    ? Number.isInteger(parsed.quantity) && parsed.quantity! >= 1 && parsed.quantity! <= 120 ? parsed.quantity! : 1
    : 1;
  const lineItems = [{ price: priceId, quantity: checkoutQuantity }];
  if (testingRequest?.seeks_abcac_credential) {
    const certificationPriceId = getPriceId("certification-certification-only-fee-already-passed-icrc-exam");
    if (!certificationPriceId) return NextResponse.json({ error: "certification_price_not_found" }, { status: 503 });
    lineItems.push({ price: certificationPriceId, quantity: 1 });
  }

  const forwardedMetadata: Record<string, string> = {};
  if (parsed.metadata && typeof parsed.metadata === "object") {
    for (const [key, value] of Object.entries(parsed.metadata)) if (value != null) forwardedMetadata[key] = String(value);
  }
  if (parsed.reciprocityRequestId) {
    forwardedMetadata.reciprocity_request_id = parsed.reciprocityRequestId;
    forwardedMetadata.payment_type = "reciprocity";
  }
  if (testingRequest) {
    forwardedMetadata.testing_request_id = testingRequest.id;
    forwardedMetadata.payment_type = "testing";
    forwardedMetadata.exam_code = testingRequest.exam_code;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: lineItems,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: testingRequest ? `${siteUrl}/account/testing` : `${siteUrl}/checkout/cancel`,
      ...(existingStripeCustomerId ? { customer: existingStripeCustomerId } : email ? { customer_email: email } : {}),
      ...(memberId ? { client_reference_id: memberId } : {}),
      metadata: {
        ...forwardedMetadata,
        slug: product.slug,
        product_name: testingRequest ? `IC&RC ${testingRequest.exam_code} exam pre-registration` : product.name,
        credential_level: credentialLevel ?? "",
        exam_mode: examMode ?? "",
        sync_months: slug === "certification-sync" ? String(checkoutQuantity) : "",
        member_id: memberId ?? "",
        ceu_note: product.category === "CEU Endorsement" ? "Submit materials to abcac@abcac.org (4-week review)" : "",
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("checkout error", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
