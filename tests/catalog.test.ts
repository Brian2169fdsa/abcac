import { describe, it, expect } from "vitest";
import {
  getProducts,
  getProductBySlug,
  formatPrice,
} from "@/lib/catalog";

describe("getProducts", () => {
  it("returns 11 products", () => {
    expect(getProducts()).toHaveLength(11);
  });

  it("every product has a non-empty slug", () => {
    getProducts().forEach((p) => {
      expect(p.slug).toBeTruthy();
    });
  });

  it("every product has a positive price", () => {
    getProducts().forEach((p) => {
      expect(p.price).toBeGreaterThan(0);
    });
  });
});

describe("getProductBySlug", () => {
  it("returns the certification-sync product with mode subscription", () => {
    const product = getProductBySlug("certification-sync");
    expect(product).toBeDefined();
    expect(product!.mode).toBe("subscription");
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getProductBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("formatPrice", () => {
  it("monthly subscription ends with /mo", () => {
    // certification-sync: $15/month subscription
    const product = getProductBySlug("certification-sync")!;
    expect(product.interval).toBe("month");
    const result = formatPrice(product);
    expect(result.endsWith("/mo")).toBe(true);
  });

  it("yearly subscription ends with /yr", () => {
    // annual-credential-fee-approved-ceu-providers: $500/year subscription
    const product = getProductBySlug("annual-credential-fee-approved-ceu-providers")!;
    expect(product.interval).toBe("year");
    const result = formatPrice(product);
    expect(result.endsWith("/yr")).toBe(true);
  });

  it("one-time payment price does not contain /", () => {
    // initial-certification-full-application-exam-fee: $375 one-time
    const product = getProductBySlug("initial-certification-full-application-exam-fee")!;
    expect(product.mode).toBe("payment");
    const result = formatPrice(product);
    expect(result).not.toContain("/");
  });
});
