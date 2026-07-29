import { describe, expect, it } from "vitest";
import {
  applicationTypeForProduct,
  authHref,
  getProductPortalDestination,
  paymentOptionsForApplication,
  portalGatewayHref,
  productRequiresApplication,
  productRequiresDedicatedWorkflow,
  safeInternalPath,
} from "@/lib/portal-routing";

describe("portal routing", () => {
  it("preserves safe internal destinations and rejects redirect attacks", () => {
    expect(safeInternalPath("/account/testing?mode=remote")).toBe("/account/testing?mode=remote");
    expect(safeInternalPath("https://evil.example")).toBe("/account");
    expect(safeInternalPath("//evil.example")).toBe("/account");
    expect(safeInternalPath("/account\\evil")).toBe("/account");
  });

  it("builds portal, login, and signup handoffs with the requested destination", () => {
    expect(portalGatewayHref("/account/forms")).toBe("/portal?next=%2Faccount%2Fforms");
    expect(authHref("login", "/account/requests")).toBe("/login?next=%2Faccount%2Frequests");
    expect(authHref("signup", "/account/testing")).toBe("/signup?next=%2Faccount%2Ftesting");
  });

  it("routes operational products to their owning portal workflow", () => {
    expect(getProductPortalDestination("initial-certification-full-application-exam-fee")).toBe("/account/certification");
    expect(getProductPortalDestination("certification-renewal-2-year-credential-renewal-fee")).toBe("/account/certification");
    expect(getProductPortalDestination("certification-sync")).toBe("/account/certification-sync");
    expect(getProductPortalDestination("icrc-reciprocity-transfer")).toBe("/account/requests");
    expect(getProductPortalDestination("testing-for-licensure-with-azbbhe-remote-proctored-exam")).toBe("/account/testing");
    expect(getProductPortalDestination("printed-certificate-copy")).toBe("/account/payments?product=printed-certificate-copy");
  });

  it("requires forms for certification, renewal, and CEU workshop payments", () => {
    expect(applicationTypeForProduct("initial-certification-full-application-exam-fee")).toBe("initial");
    expect(applicationTypeForProduct("certification-renewal-2-year-credential-renewal-fee")).toBe("renewal");
    expect(applicationTypeForProduct("ceu-workshop-endorsement-up-to-8-contact-hours")).toBe("ceu_workshop");
    expect(productRequiresApplication("initial-certification-full-application-exam-fee")).toBe(true);
    expect(productRequiresApplication("printed-certificate-copy")).toBe(false);
  });

  it("blocks generic payment pages for dedicated workflows", () => {
    expect(productRequiresDedicatedWorkflow("certification-sync")).toBe("/account/certification-sync");
    expect(productRequiresDedicatedWorkflow("icrc-reciprocity-transfer")).toBe("/account/requests");
    expect(productRequiresDedicatedWorkflow("testing-for-licensure-with-azbbhe-in-person-exam")).toBe("/account/testing");
  });

  it("creates application-specific payment choices", () => {
    const initial = paymentOptionsForApplication("initial", "app 1");
    expect(initial).toHaveLength(3);
    expect(initial.every((option) => option.href.includes("application=app%201"))).toBe(true);

    const renewal = paymentOptionsForApplication("renewal", "renew-1");
    expect(renewal).toEqual([
      {
        label: "Two-year credential renewal — $150",
        href: "/account/payments?product=certification-renewal-2-year-credential-renewal-fee&application=renew-1",
      },
    ]);
  });
});
