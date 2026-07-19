import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProductBySlug, getPriceId } from "@/lib/catalog";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { TESTING_PRODUCT_BY_MODE, isTestingMode } from "@/lib/testing-requests";
import { normalizePaymentIntake, type PaymentIntakeInput } from "@/lib/payment-submissions";

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
    syncApplicationId?: string;
    paymentForm?: PaymentIntakeInput;
    metadata?: Record<string, unknown>;
  };
  try { parsed = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  let memberId: string | null = null;
  let authEmail: string | undefined;
  let existingStripeCustomerId: string | null = null;
  let profile: any = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      memberId = user.id;
      authEmail = user.email ?? undefined;
      const { data } = await supabase.from("profiles").select("stripe_customer_id,first_name,last_name,email,phone").eq("id", user.id).maybeSingle();
      profile = data;
      existingStripeCustomerId = data?.stripe_customer_id ?? null;
    }
  } catch { /* guest checkout is permitted only with a complete payment form */ }

  let slug = parsed.slug;
  let credentialLevel = parsed.credentialLevel;
  let examMode = parsed.examMode;
  let formType = "general_payment";
  let linkedRecordType: string | null = null;
  let linkedRecordId: string | null = null;
  let formPayload: Record<string, unknown> = {};
  let testingRequest: any = null;
  let intake = normalizePaymentIntake(parsed.paymentForm);

  if (!parsed.testingRequestId && (typeof slug !== "string" || !slug)) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  if (parsed.testingRequestId) {
    if (!memberId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    const { data } = await supabase.from("testing_requests")
      .select("id,member_id,exam_code,testing_mode,seeks_abcac_credential,credential_level,status,purchaser_first_name,purchaser_last_name,purchaser_email,purchaser_phone,tester_first_name,tester_last_name,tester_email")
      .eq("id", parsed.testingRequestId).eq("member_id", memberId).maybeSingle();
    if (!data) return NextResponse.json({ error: "testing_request_not_found" }, { status: 404 });
    if (data.status !== "awaiting_payment") return NextResponse.json({ error: "testing_request_not_payable" }, { status: 409 });
    if (!isTestingMode(data.testing_mode)) return NextResponse.json({ error: "invalid_testing_mode" }, { status: 400 });
    testingRequest = data;
    slug = TESTING_PRODUCT_BY_MODE[data.testing_mode];
    credentialLevel = data.credential_level ?? data.exam_code;
    examMode = data.testing_mode;
    formType = "testing_preregistration";
    linkedRecordType = "testing_requests";
    linkedRecordId = data.id;
    intake = normalizePaymentIntake({ firstName: data.purchaser_first_name, lastName: data.purchaser_last_name, email: data.purchaser_email, phone: data.purchaser_phone });
    formPayload = { examCode: data.exam_code, testerName: `${data.tester_first_name} ${data.tester_last_name}`, testerEmail: data.tester_email };
  } else if (parsed.reciprocityRequestId) {
    if (!memberId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    const { data } = await supabase.from("reciprocity_requests").select("id,member_id,direction,credential,destination,status,payment_status").eq("id", parsed.reciprocityRequestId).eq("member_id", memberId).maybeSingle();
    if (!data) return NextResponse.json({ error: "reciprocity_request_not_found" }, { status: 404 });
    formType = "reciprocity_request";
    linkedRecordType = "reciprocity_requests";
    linkedRecordId = data.id;
    intake = normalizePaymentIntake({ firstName: profile?.first_name, lastName: profile?.last_name, email: profile?.email ?? authEmail, phone: profile?.phone });
    formPayload = { direction: data.direction, credential: data.credential, destination: data.destination };
  } else {
    const syncApplicationId = parsed.syncApplicationId || (typeof parsed.metadata?.sync_application_id === "string" ? parsed.metadata.sync_application_id : undefined);
    if (slug === "certification-sync" && syncApplicationId) {
      if (!memberId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
      const { data } = await supabase.from("applications").select("id,member_id,app_type,cert_type,status,member_notes").eq("id", syncApplicationId).eq("member_id", memberId).eq("app_type", "cert_sync").maybeSingle();
      if (!data) return NextResponse.json({ error: "sync_request_not_found" }, { status: 404 });
      formType = "certification_sync";
      linkedRecordType = "applications";
      linkedRecordId = data.id;
      let details: Record<string, unknown> = {};
      try { details = JSON.parse(data.member_notes || "{}"); } catch { /* keep verified application summary only */ }
      const fullName = String(details.fullName || "").trim().split(/\s+/);
      intake = normalizePaymentIntake({
        firstName: profile?.first_name || fullName[0],
        lastName: profile?.last_name || fullName.slice(1).join(" "),
        email: profile?.email ?? authEmail,
        phone: profile?.phone || String(details.phone || ""),
      });
      formPayload = { applicationId: data.id, certType: data.cert_type, request: details };
    }
  }

  if (!intake) return NextResponse.json({ error: "payment_form_required" }, { status: 400 });
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

  const { data: paymentSubmission, error: submissionError } = await admin.from("payment_submissions").insert({
    member_id: memberId,
    form_type: formType,
    linked_record_type: linkedRecordType,
    linked_record_id: linkedRecordId,
    product_slug: product.slug,
    product_name: testingRequest ? `IC&RC ${testingRequest.exam_code} exam pre-registration` : product.name,
    payer_first_name: intake.firstName,
    payer_last_name: intake.lastName,
    payer_email: intake.email,
    payer_phone: intake.phone,
    credential_level: credentialLevel || null,
    exam_mode: examMode || null,
    reference_number: intake.referenceNumber,
    notes: intake.notes,
    form_payload: formPayload,
  }).select("id").single();
  if (submissionError || !paymentSubmission?.id) return NextResponse.json({ error: "payment_form_save_failed" }, { status: 500 });

  const forwardedMetadata: Record<string, string> = {};
  if (parsed.metadata && typeof parsed.metadata === "object") {
    for (const [key, value] of Object.entries(parsed.metadata)) if (value != null) forwardedMetadata[key] = String(value);
  }
  if (linkedRecordType === "reciprocity_requests") {
    forwardedMetadata.reciprocity_request_id = linkedRecordId!;
    forwardedMetadata.payment_type = "reciprocity";
  }
  if (testingRequest) {
    forwardedMetadata.testing_request_id = testingRequest.id;
    forwardedMetadata.payment_type = "testing";
    forwardedMetadata.exam_code = testingRequest.exam_code;
  }
  if (formType === "certification_sync") {
    forwardedMetadata.payment_type = "cert_sync";
    forwardedMetadata.sync_application_id = linkedRecordId!;
  }

  const productName = testingRequest ? `IC&RC ${testingRequest.exam_code} exam pre-registration` : product.name;
  const checkoutMetadata = {
    ...forwardedMetadata,
    payment_submission_id: paymentSubmission.id,
    form_type: formType,
    linked_record_type: linkedRecordType ?? "",
    linked_record_id: linkedRecordId ?? "",
    slug: product.slug,
    product_name: productName,
    credential_level: credentialLevel ?? "",
    exam_mode: examMode ?? "",
    sync_months: slug === "certification-sync" ? String(checkoutQuantity) : "",
    member_id: memberId ?? "",
    ceu_note: product.category === "CEU Endorsement" ? "Submit materials to abcac@abcac.org (4-week review)" : "",
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: lineItems,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: testingRequest ? `${siteUrl}/account/testing` : `${siteUrl}/checkout/cancel`,
      ...(existingStripeCustomerId ? { customer: existingStripeCustomerId } : { customer_email: intake.email }),
      ...(memberId ? { client_reference_id: memberId } : {}),
      metadata: checkoutMetadata,
      ...(product.mode === "subscription" ? { subscription_data: { metadata: checkoutMetadata } } : {}),
    });
    await admin.from("payment_submissions").update({ status: "checkout_created", stripe_session_id: session.id }).eq("id", paymentSubmission.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("checkout error", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
