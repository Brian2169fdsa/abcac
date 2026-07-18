import { describe, it, expect } from "vitest";
import {
  getProducts,
  getProductBySlug,
  getCategories,
  getPriceId,
  formatPrice,
} from "@/lib/catalog";

describe("getProducts", () => {
  it("returns 13 products", () => {
    expect(getProducts()).toHaveLength(13);
  });
});

describe("icrc-reciprocity-transfer", () => {
  it("is a $150 one-time payment product", () => {
    const product = getProductBySlug("icrc-reciprocity-transfer");
    expect(product).toBeDefined();
    expect(product!.price).toBe(150);
    expect(product!.mode).toBe("payment");
  });
});

describe("getCategories", () => {
  it("includes 'Certification'", () => {
    expect(getCategories()).toContain("Certification");
  });

  it("includes 'CEU Endorsement'", () => {
    expect(getCategories()).toContain("CEU Endorsement");
  });
});

describe("getProductBySlug", () => {
  it("certification-sync is a one-time payment", () => {
    const product = getProductBySlug("certification-sync");
    expect(product).toBeDefined();
    expect(product!.mode).toBe("payment");
    expect(product!.interval).toBeUndefined();
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getProductBySlug("nope")).toBeUndefined();
  });
});

describe("formatPrice", () => {
  it("certification-sync formats without a recurring suffix", () => {
    const product = getProductBySlug("certification-sync")!;
    expect(formatPrice(product)).toBe("$15.00");
  });

  it("annual provider product ($500/yr) formats with '/yr' suffix", () => {
    const product = getProductBySlug("annual-credential-fee-approved-ceu-providers")!;
    expect(product).toBeDefined();
    expect(product.interval).toBe("year");
    expect(formatPrice(product).endsWith("/yr")).toBe(true);
  });
});

describe("getPriceId", () => {
  it("returns undefined for a slug that does not exist in the price map", () => {
    expect(getPriceId("nope-not-real")).toBeUndefined();
  });
});
