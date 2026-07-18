import { describe, it, expect } from "vitest";
import {
  getProducts,
  getProductBySlug,
  formatPrice,
} from "@/lib/catalog";

describe("getProducts", () => {
  it("returns 13 products", () => {
    expect(getProducts()).toHaveLength(13);
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
  it("returns certification-sync as a one-time quantity payment", () => {
    const product = getProductBySlug("certification-sync");
    expect(product).toBeDefined();
    expect(product!.mode).toBe("payment");
    expect(product!.interval).toBeUndefined();
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getProductBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("formatPrice", () => {
  it("certification sync has no recurring suffix", () => {
    const product = getProductBySlug("certification-sync")!;
    const result = formatPrice(product);
    expect(result).toBe("$15.00");
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
