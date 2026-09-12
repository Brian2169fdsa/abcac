import { formatPrice, getProductBySlug } from "@/lib/catalog";

const DEFAULT_PORTAL_PATH = "/account";

export function safeInternalPath(value: string | null | undefined, fallback = DEFAULT_PORTAL_PATH) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001F]/.test(value)) {
    return fallback;
  }
  return value;
}

export function portalGatewayHref(next = DEFAULT_PORTAL_PATH) {
  return `/portal?next=${encodeURIComponent(safeInternalPath(next))}`;
}

export function authHref(type: "login" | "signup", next = DEFAULT_PORTAL_PATH) {
  return `/${type}?next=${encodeURIComponent(safeInternalPath(next))}`;
}

export function getProductPortalDestination(slug: string) {
  if (slug.startsWith("initial-certification") || slug.includes("certification-only") || slug === "peer-recovery-associate-application-fee") {
    return "/account/certification";
  }
  if (slug === "certification-renewal-2-year-credential-renewal-fee") {
    return "/account/certification";
  }
  if (slug === "certification-sync") {
    return "/account/certification-sync";
  }
  if (slug === "icrc-reciprocity-transfer") {
    return "/account/requests";
  }
  if (slug.startsWith("testing-for-licensure")) {
    return "/account/testing";
  }
  if (slug.startsWith("ceu-workshop-endorsement")) {
    return "/account/forms?workflow=ceu%3Aworkshop";
  }
  return `/account/payments?product=${encodeURIComponent(slug)}`;
}

export function applicationTypeForProduct(slug: string) {
  if (slug.startsWith("initial-certification") || slug.includes("certification-only") || slug === "peer-recovery-associate-application-fee") return "initial";
  if (slug === "certification-renewal-2-year-credential-renewal-fee") return "renewal";
  if (slug.startsWith("ceu-workshop-endorsement")) return "ceu_workshop";
  return null;
}

export function productRequiresApplication(slug: string) {
  return applicationTypeForProduct(slug) !== null;
}

export function productRequiresDedicatedWorkflow(slug: string) {
  if (slug === "certification-sync") return "/account/certification-sync";
  if (slug === "icrc-reciprocity-transfer") return "/account/requests";
  if (slug.startsWith("testing-for-licensure")) return "/account/testing";
  return null;
}

export type PortalPaymentOption = { label: string; href: string };

/**
 * "<prefix> — $price" for a catalog slug, with the price read from the
 * catalog (src/data/products.json) — the same source of truth Stripe
 * checkout prices off — instead of hand-typed here where it could drift.
 * Falls back to the bare prefix if the slug isn't in the catalog.
 */
function priceLabel(prefix: string, slug: string): string {
  const product = getProductBySlug(slug);
  return product ? `${prefix} — ${formatPrice(product)}` : prefix;
}

export function paymentOptionsForApplication(appType: string, applicationId: string, certType?: string | null): PortalPaymentOption[] {
  const paymentHref = (slug: string) =>
    `/account/payments?product=${encodeURIComponent(slug)}&application=${encodeURIComponent(applicationId)}`;
  if (appType === "initial" && certType === "PRA") {
    // PR-A has its own single flat application fee, not the IC&RC exam-mode
    // tiers the other initial credentials share (see PRA-Application-Manual-2.docx).
    return [{ label: priceLabel("Application fee", "peer-recovery-associate-application-fee"), href: paymentHref("peer-recovery-associate-application-fee") }];
  }
  if (appType === "initial") {
    return [
      { label: priceLabel("Application + in-person exam", "initial-certification-full-application-exam-fee"), href: paymentHref("initial-certification-full-application-exam-fee") },
      { label: priceLabel("Application + remote exam", "initial-certification-full-application-exam-fee-remote-proctored-exam"), href: paymentHref("initial-certification-full-application-exam-fee-remote-proctored-exam") },
      { label: priceLabel("Certification only", "certification-certification-only-fee-already-passed-icrc-exam"), href: paymentHref("certification-certification-only-fee-already-passed-icrc-exam") },
    ];
  }
  if (appType === "renewal") {
    return [{ label: priceLabel("Two-year credential renewal", "certification-renewal-2-year-credential-renewal-fee"), href: paymentHref("certification-renewal-2-year-credential-renewal-fee") }];
  }
  if (appType === "ceu_workshop") {
    return [
      { label: priceLabel("Up to 8 contact hours", "ceu-workshop-endorsement-up-to-8-contact-hours"), href: paymentHref("ceu-workshop-endorsement-up-to-8-contact-hours") },
      { label: priceLabel("9–15 contact hours", "ceu-workshop-endorsement-9-15-contact-hours"), href: paymentHref("ceu-workshop-endorsement-9-15-contact-hours") },
      { label: priceLabel("More than 15 contact hours", "ceu-workshop-endorsement-more-than-15-contact-hours"), href: paymentHref("ceu-workshop-endorsement-more-than-15-contact-hours") },
    ];
  }
  return [];
}
