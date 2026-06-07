import Stripe from "stripe";

// Server-only Stripe instance. Never import this into a client component.
const key = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(key ?? "", {
  apiVersion: "2024-06-20",
  appInfo: { name: "ABCAC Frontend" },
});

export const isStripeConfigured = Boolean(key);

// Publishable key for the browser (safe to expose).
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
