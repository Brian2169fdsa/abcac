#!/usr/bin/env node
// One-time setup: create live Stripe Products/Prices for every catalog
// product that doesn't have one yet, write the results into
// src/data/stripe-price-map.live.json, and create the live webhook endpoint
// this app needs (checkout.session.completed/async_payment_succeeded/expired/
// async_payment_failed, invoice.paid) pointed at /api/stripe/webhook.
//
// This CANNOT be run from the Claude Code sandbox — that session's network
// policy blocks api.stripe.com. Run it yourself, anywhere with real internet
// access (your laptop, a GitHub Action, etc.):
//
//   STRIPE_SECRET_KEY=rk_live_... SITE_URL=https://www.abcac.org node scripts/setup-stripe-live.mjs
//
// It is safe to re-run: products/prices already present in the live map are
// skipped, and it reuses an existing webhook endpoint for the same URL
// instead of creating a duplicate (though it cannot print that endpoint's
// signing secret again — only a fresh one prints its secret).

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (rk_live_... or sk_live_...) in the environment first.");
  process.exit(1);
}
if (!key.includes("_live_")) {
  console.error("This key is not a live key (expected rk_live_... or sk_live_...). Refusing to run — use the Dashboard for test mode, or pass a live key on purpose.");
  process.exit(1);
}
const siteUrl = (process.env.SITE_URL || "https://www.abcac.org").replace(/\/$/, "");

const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

const catalogPath = join(root, "src/data/products.json");
const liveMapPath = join(root, "src/data/stripe-price-map.live.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const liveMap = JSON.parse(readFileSync(liveMapPath, "utf8"));

console.log(`Loaded ${catalog.products.length} catalog products; ${Object.keys(liveMap).length} already mapped live.\n`);

for (const product of catalog.products) {
  if (liveMap[product.slug]) {
    console.log(`skip  ${product.slug} — already mapped to ${liveMap[product.slug]}`);
    continue;
  }
  const isRecurring = typeof product.billing === "string";
  const interval = isRecurring && product.billing.toLowerCase().includes("year") ? "year" : "month";

  const created = await stripe.products.create({
    name: product.name,
    metadata: { slug: product.slug, category: product.category },
  });

  const price = await stripe.prices.create({
    product: created.id,
    currency: catalog.currency || "usd",
    unit_amount: Math.round(product.price * 100),
    ...(isRecurring ? { recurring: { interval } } : {}),
  });

  liveMap[product.slug] = price.id;
  console.log(`create ${product.slug} — product ${created.id}, price ${price.id} ($${product.price}${isRecurring ? `/${interval}` : ""})`);
}

writeFileSync(liveMapPath, JSON.stringify(liveMap, null, 2) + "\n");
console.log(`\nWrote ${liveMapPath}`);

// ── Webhook endpoint ────────────────────────────────────────────────────────
const webhookUrl = `${siteUrl}/api/stripe/webhook`;
const neededEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
  "invoice.paid",
];

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
const match = existing.data.find((e) => e.url === webhookUrl);

if (match) {
  console.log(`\nA webhook endpoint for ${webhookUrl} already exists (${match.id}).`);
  console.log("Its signing secret can't be retrieved again — if you don't already have it saved,");
  console.log("delete and recreate this endpoint in the Stripe Dashboard, or roll its secret there.");
} else {
  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: neededEvents,
  });
  console.log(`\nCreated webhook endpoint ${endpoint.id} for ${webhookUrl}`);
  console.log("STRIPE_WEBHOOK_SECRET (save this now — Stripe will not show it again):");
  console.log(endpoint.secret);
}

console.log("\nNext: add STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET");
console.log("to the Vercel project's Environment Variables, then redeploy.");
