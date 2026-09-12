import { NextResponse } from "next/server";
import { paymentsEnabled } from "@/lib/feature-flags";
import { requestOrigin } from "@/lib/request-origin";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProductBySlug, getPriceId } from "@/lib/catalog";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { TESTING_PRODUCT_BY_MODE, isTestingMode } from "@/lib/testing-requests";
import { normalizePaymentIntake, type PaymentIntakeInput } from "@/lib/payment-submissions";
import {
  applicationTypeForProduct,
  productRequiresApplication,
  productRequiresDedicatedWorkflow,
} from "@/lib/portal-routing";

export const runtime = "nodejs";

/**
 * Metadata keys the Stripe webhook treats as authoritative. The server sets
 * these from verified, member-owned records; clients can never supply them.
 */
const RESERVED_METADATA_KEYS = new Set([
  "payment_type",
  "payment_submission_id",
  "form_type",
  "linked_record_type",
  "linked_record_id",
  "invoice_id",
  "reciprocity_request_id",
  "testing_request_id",
  "sync_application_id",
  "application_id",
  "exam_code",
  "member_id",
  "slug",
  "product_name",
  "credential_level",
  "exam_mode",
  "sync_months",
  "portal_return_path",
]);

export async function POST(req: Request) {
  if (!paymentsEnabled) return NextResponse.json({ error: "payments_paused" }, { status: 503 });
  if (!isStripeConfigured) return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });

  let parsed: {
    slug?: string;
    credentialLevel?: string;
    examMode?: string;
    quantity?: number;
    reciprocityRequestId?: string;
    testingRequestId?: string;
    syncApplicationId?: string;
    applicationId?: string;
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
  } catch { /* fall through to the explicit authentication check below */ }

  // All payments happen inside the member portal — checkout requires a signed-in
  // member so every charge is attributed to an account they can manage it from.
  if (!memberId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

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
    slug = "icrc-reciprocity-transfer";
    formType = "reciprocity_request";
    linkedRecordType = "reciprocity_requests";
    linkedRecordId = data.id;
    intake = normalizePaymentIntake({
      firstName: profile?.first_name,
      lastName: profile?.last_name,
      email: profile?.email ?? authEmail,
      phone: profile?.phone,
    }) ?? intake;
    formPayload = { direction: data.direction, credential: data.credential, destination: data.destination };
  } else {
    const syncApplicationId = parsed.syncApplicationId || (typeof parsed.metadata?.sync_application_id === "string" ? parsed.metadata.sync_application_id : undefined);
    if (syncApplicationId && slug !== "certification-sync") {
      return NextResponse.json({ error: "invalid_sync_product" }, { status: 400 });
    }
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
      }) ?? intake;
      formPayload = { applicationId: data.id, certType: data.cert_type, request: details };
    } else if (parsed.applicationId) {
      // Application-packet fee (initial certification, renewal, CEU workshop):
      // link the charge to the member's application so admin review shows a
      // fee-paid indicator and the webhook can advance the application.
      const { data } = await supabase.from("applications").select("id,app_type,cert_type,status")
        .eq("id", parsed.applicationId).eq("member_id", memberId).maybeSingle();
      if (!data) return NextResponse.json({ error: "application_not_found" }, { status: 404 });
      formType = "application_fee";
      linkedRecordType = "applications";
      linkedRecordId = data.id;
      formPayload = { applicationId: data.id, appType: data.app_type, certType: data.cert_type, status: data.status };
    }
  }

  // Members with a complete profile don't need to retype payer details.
  if (!intake && profile) {
    intake = normalizePaymentIntake({
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email ?? authEmail,
      phone: profile.phone,
    });
  }
  if (!intake) return NextResponse.json({ error: "payment_form_required" }, { status: 400 });
  if (typeof slug !== "string" || !slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  const product = getProductBySlug(slug);
  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  const dedicatedWorkflow = productRequiresDedicatedWorkflow(product.slug);
  const hasDedicatedRecord =
    (product.slug === "certification-sync" && formType === "certification_sync") ||
    (product.slug === "icrc-reciprocity-transfer" && formType === "reciprocity_request") ||
    (product.slug.startsWith("testing-for-licensure") && formType === "testing_preregistration");
  if (dedicatedWorkflow && !hasDedicatedRecord) {
    return NextResponse.json(
      { error: "workflow_required", workflow: dedicatedWorkflow },
      { status: 409 },
    );
  }

  if (productRequiresApplication(product.slug)) {
    if (formType !== "application_fee" || linkedRecordType !== "applications" || !linkedRecordId) {
      return NextResponse.json({ error: "application_required" }, { status: 409 });
    }
    const expectedType = applicationTypeForProduct(product.slug);
    if (formPayload.appType !== expectedType) {
      return NextResponse.json({ error: "application_type_mismatch" }, { status: 409 });
    }
    if (!["submitted", "under_review"].includes(String(formPayload.status ?? ""))) {
      return NextResponse.json({ error: "application_not_payable" }, { status: 409 });
    }
  }

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

  // Caller-supplied metadata is informational only. Any key the webhook uses to
  // decide WHAT a payment settles (invoice ids, request ids, payment_type…) is
  // reserved and set exclusively by the server below — otherwise a member could
  // buy a $25 item and have the webhook mark an unrelated record paid.
  const forwardedMetadata: Record<string, string> = {};
  if (parsed.metadata && typeof parsed.metadata === "object") {
    for (const [key, value] of Object.entries(parsed.metadata)) {
      if (value == null || RESERVED_METADATA_KEYS.has(key)) continue;
      forwardedMetadata[key] = String(value);
    }
  }
  forwardedMetadata.payment_type = "general";
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
  if (formType === "application_fee") {
    forwardedMetadata.payment_type = "application_fee";
    forwardedMetadata.application_id = linkedRecordId!;
  }

  const productName = testingRequest ? `IC&RC ${testingRequest.exam_code} exam pre-registration` : product.name;
  const checkoutMetadata: Record<string, string> = {
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

  const siteUrl = requestOrigin(req);
  const portalReturnPath =
    formType === "testing_preregistration"
      ? "/account/testing"
      : formType === "certification_sync"
        ? "/account/certification-sync"
        : formType === "reciprocity_request"
          ? "/account/requests"
          : formType === "application_fee"
            ? "/account/applications"
            : "/account/payments";
  checkoutMetadata.portal_return_path = portalReturnPath;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      line_items: lineItems,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}${portalReturnPath}`,
      ...(existingStripeCustomerId
        ? { customer: existingStripeCustomerId }
        // Guest one-time checkout does not create a Stripe Customer object by
        // default, which would leave stripe_customer_id permanently unset and
        // break the Billing Portal link (/api/stripe/portal) for a member
        // whose only charges were one-time payments. Subscription mode always
        // creates a customer on its own and rejects this param, so it's only
        // needed for "payment" mode.
        : { customer_email: intake.email, ...(product.mode === "payment" ? { customer_creation: "always" as const } : {}) }),
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
