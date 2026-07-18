/**
 * Idempotently create a Stripe Product + Price for every catalog item and
 * write the resulting price ids to src/data/stripe-price-map.json.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe.ts
 *
 * Idempotent: products are matched by metadata.slug; prices are reused when an
 * active price with the same unit amount + interval already exists.
 */
import Stripe from "stripe";
import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvConfig(process.cwd());

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

interface RawProduct {
  slug: string;
  name: string;
  price: number;
  billing?: string;
  short: string;
}

const dataPath = resolve(process.cwd(), "src/data/products.json");
const mapPath = resolve(process.cwd(), "src/data/stripe-price-map.json");
const catalog = JSON.parse(readFileSync(dataPath, "utf8")) as { products: RawProduct[] };

async function findProductBySlug(slug: string): Promise<Stripe.Product | null> {
  const res = await stripe.products.search({ query: `metadata['slug']:'${slug}'`, limit: 1 });
  return res.data[0] ?? null;
}

async function run() {
  const priceMap: Record<string, string> = {};

  for (const p of catalog.products) {
    const isSub = typeof p.billing === "string";
    const interval = isSub ? (p.billing!.toLowerCase().includes("year") ? "year" : "month") : undefined;
    const unitAmount = Math.round(p.price * 100);

    let product = await findProductBySlug(p.slug);
    if (!product) {
      product = await stripe.products.create({
        name: p.name,
        description: p.short.slice(0, 350),
        metadata: { slug: p.slug },
      });
      console.log(`+ product ${p.slug} → ${product.id}`);
    } else {
      console.log(`= product ${p.slug} → ${product.id}`);
    }

    // Reuse an existing active price with the same shape, else create one.
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    let price = prices.data.find(
      (pr) =>
        pr.unit_amount === unitAmount &&
        pr.currency === "usd" &&
        (interval ? pr.recurring?.interval === interval : !pr.recurring),
    );
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: unitAmount,
        ...(interval ? { recurring: { interval } } : {}),
        metadata: { slug: p.slug },
      });
      console.log(`  + price ${price.id} (${unitAmount}c${interval ? `/${interval}` : ""})`);
    } else {
      console.log(`  = price ${price.id}`);
    }
    priceMap[p.slug] = price.id;
  }

  writeFileSync(mapPath, JSON.stringify(priceMap, null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(priceMap).length} price ids → ${mapPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
