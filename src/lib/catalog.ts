import catalog from "@/data/products.json";
import testPriceMap from "@/data/stripe-price-map.test.json";
import livePriceMap from "@/data/stripe-price-map.live.json";

export type BillingInterval = "month" | "year";
export type CheckoutMode = "payment" | "subscription";

export interface Product {
  slug: string;
  name: string;
  /** Price in US dollars (source of truth — never hand-typed in components). */
  price: number;
  category: string;
  examMode: string | null;
  short: string;
  includes: string[];
  /** Present only for recurring products. */
  billing?: string;
  mode: CheckoutMode;
  interval?: BillingInterval;
}

interface RawProduct {
  slug: string;
  name: string;
  price: number;
  category: string;
  exam_mode: string | null;
  short: string;
  includes: string[];
  billing?: string;
}

function normalize(p: RawProduct): Product {
  const isSub = typeof p.billing === "string";
  const interval: BillingInterval | undefined = !isSub
    ? undefined
    : p.billing!.toLowerCase().includes("year")
      ? "year"
      : "month";
  return {
    slug: p.slug,
    name: p.name,
    price: p.price,
    category: p.category,
    examMode: p.exam_mode,
    short: p.short,
    includes: p.includes ?? [],
    billing: p.billing,
    mode: isSub ? "subscription" : "payment",
    interval,
  };
}

const PRODUCTS: Product[] = (catalog.products as RawProduct[]).map(normalize);

export const CURRENCY = catalog.currency ?? "usd";

export function getProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getCategories(): string[] {
  return Array.from(new Set(PRODUCTS.map((p) => p.category)));
}

export type StripeMode = "test" | "live";

export function getStripeMode(key = process.env.STRIPE_SECRET_KEY): StripeMode | undefined {
  if (key?.startsWith("sk_test_") || key?.startsWith("rk_test_")) return "test";
  if (key?.startsWith("sk_live_") || key?.startsWith("rk_live_")) return "live";
  return undefined;
}

/** Stripe price id for a slug, selected from the map matching the active key. */
export function getPriceId(slug: string, key = process.env.STRIPE_SECRET_KEY): string | undefined {
  const mode = getStripeMode(key);
  if (!mode) return undefined;
  const priceMap = mode === "live" ? livePriceMap : testPriceMap;
  return (priceMap as Record<string, string>)[slug];
}

/** Formats a dollar amount with the correct billing suffix. */
export function formatPrice(product: Pick<Product, "price" | "mode" | "interval">): string {
  const base = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(product.price);
  if (product.mode === "subscription") {
    return product.interval === "year" ? `${base} /yr` : `${base} /mo`;
  }
  return base;
}
