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
  if (slug.startsWith("initial-certification") || slug.includes("certification-only")) {
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
  if (slug.startsWith("initial-certification") || slug.includes("certification-only")) return "initial";
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

export function paymentOptionsForApplication(appType: string, applicationId: string): PortalPaymentOption[] {
  const paymentHref = (slug: string) =>
    `/account/payments?product=${encodeURIComponent(slug)}&application=${encodeURIComponent(applicationId)}`;
  if (appType === "initial") {
    return [
      { label: "Application + in-person exam — $375", href: paymentHref("initial-certification-full-application-exam-fee") },
      { label: "Application + remote exam — $425", href: paymentHref("initial-certification-full-application-exam-fee-remote-proctored-exam") },
      { label: "Certification only — $150", href: paymentHref("certification-certification-only-fee-already-passed-icrc-exam") },
    ];
  }
  if (appType === "renewal") {
    return [{ label: "Two-year credential renewal — $150", href: paymentHref("certification-renewal-2-year-credential-renewal-fee") }];
  }
  if (appType === "ceu_workshop") {
    return [
      { label: "Up to 8 contact hours — $250", href: paymentHref("ceu-workshop-endorsement-up-to-8-contact-hours") },
      { label: "9–15 contact hours — $375", href: paymentHref("ceu-workshop-endorsement-9-15-contact-hours") },
      { label: "More than 15 contact hours — $500", href: paymentHref("ceu-workshop-endorsement-more-than-15-contact-hours") },
    ];
  }
  return [];
}
