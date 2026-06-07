# Stripe — Local Testing

All commerce runs in **test mode** until live keys are set (see DECISIONS.md).

## 1. Seed products + prices
```bash
STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe.ts
```
This creates/updates all 11 Stripe products and writes `src/data/stripe-price-map.json`. Re-running is safe (idempotent).

## 2. Run the app
```bash
npm run dev   # http://localhost:3000
```

## 3. Forward webhooks to localhost
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the `whsec_...` it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.

## 4. Test a purchase
- Visit `/store`, open any product, click **Proceed to Payment**.
- Use test card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.
- One-time items use `mode: payment`; **Certification Sync** ($15/mo) and **Annual Credential Fee** ($500/yr) use `mode: subscription`.
- After paying you land on `/checkout/success`; the webhook writes a `payments` row and applies credential side effects (if those tables exist — otherwise it logs a backend dependency and no-ops).

## 5. Replay / idempotency
```bash
stripe events resend <evt_id>
```
A resent event must NOT create a second `payments` row (guarded by `stripe_event_id`).

## Going live
1. Swap `sk_test_*` / `pk_test_*` for live keys and re-run the seed against live mode.
2. Register the production webhook endpoint in the Stripe dashboard (`/api/stripe/webhook`) for `checkout.session.completed` and `invoice.paid`; set the live `STRIPE_WEBHOOK_SECRET`.
3. Set all env vars in the Vercel project.
