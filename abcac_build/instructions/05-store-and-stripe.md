# 05 — Store & Stripe Integration (core commerce)

## Context
The Duda "store" only collects payments. Replace it with Stripe Checkout, fully driven by `reference/products.json` (copied to `src/data/products.json`). Two items are recurring; the rest are one-time. Every successful payment must post back to Supabase against the member (see `instructions/06`).

## Catalog (source of truth = products.json — never hand-type prices)
| Slug | Product | Price | Stripe mode |
|---|---|---|---|
| `initial-certification-full-application-exam-fee` | Initial Certification – Full Application & Exam Fee | $375.00 | payment |
| `initial-certification-full-application-exam-fee-remote-proctored-exam` | …(Remote Proctored Exam) | $425.00 | payment |
| `certification-certification-only-fee-already-passed-icrc-exam` | Certification-Only Fee – Already Passed IC&RC Exam | $150.00 | payment |
| `certification-renewal-2-year-credential-renewal-fee` | Certification Renewal – 2-Year | $150.00 | payment |
| `certification-sync` | Certification Sync | $15.00 | **subscription (month)** |
| `testing-for-licensure-with-azbbhe` | Testing w/ ABCAC &/or AZBBHE – In Person | $225.00 | payment |
| `testing-for-licensure-with-azbbhe-remote-proctored-exam` | Testing … – Remote Proctored | $275.00 | payment |
| `ceu-workshop-endorsement-up-to-8-contact-hours` | CEU Endorsement (Up to 8 hrs) | $250.00 | payment |
| `ceu-workshop-endorsement-9-15-contact-hours` | CEU Endorsement (9–15 hrs) | $375.00 | payment |
| `ceu-workshop-endorsement-more-than-15-contact-hours` | CEU Endorsement (>15 hrs) | $500.00 | payment |
| `annual-credential-fee-approved-ceu-providers` | Annual Credential Fee – CEU Providers | $500.00 | **subscription (year)** |

## Build Steps
1. **Seed script** `scripts/seed-stripe.ts` (run with `tsx`):
   - Loop `products.json`. For each, create/upsert a Stripe **Product** (idempotent: look up by `metadata.slug`) and a **Price** (cents = `price*100`, `currency: usd`). Recurring items get `recurring.interval` = `month` (sync) / `year` (annual provider).
   - Write the resulting Stripe `price_id` back into `products.json` (or a generated `src/data/stripe-price-map.json`). Log run output.
2. **Store page** `/store` (`content/store.txt` intro + grid): render a `product-card` per catalog item, grouped by category (Certification, Renewal, Testing, CEU Endorsement, Service, Provider Fee). Intro copy is the welcome paragraph from the source.
3. **Product detail** `/store/[slug]`: name, `price-tag`, full description + "includes" bullets from `products.json`, and a **"Proceed to Payment"** button that POSTs to the checkout API. For items needing context, render a small form first:
   - Certification & testing items → capture **credential level** (select: CAC/CADAC/AADC/CCS/CCJP/CPRS/CPS) and confirm **exam mode** (matches the slug's in-person/remote).
   - CEU endorsement items → show notice: "Submit workshop materials to abcac@abcac.org. Standard review turnaround: 4 weeks." (carry as metadata note).
4. **Checkout API** `app/api/stripe/checkout/route.ts` (POST):
   - Input: `{ slug, credentialLevel?, examMode?, email? }`. Resolve price_id from the map.
   - Create a Checkout Session: `mode` from catalog (payment|subscription), `line_items: [{ price, quantity: 1 }]`, `success_url = ${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url = ${SITE_URL}/checkout/cancel`.
   - Attach **metadata**: `slug`, `product_name`, `credential_level`, `exam_mode`, `member_id` (from auth session if logged in — see `instructions/06`), `ceu_note`.
   - If the member is authenticated, set `customer_email`/`client_reference_id` to tie back to Supabase.
   - Return `{ url }`; client redirects.
5. **Webhook** `app/api/stripe/webhook/route.ts` (POST, raw body, verify with `STRIPE_WEBHOOK_SECRET`):
   - Handle `checkout.session.completed` (one-time + first subscription invoice) and `invoice.paid` (recurring renewals).
   - On success, upsert a `payments` row in Supabase (see schema contract in `instructions/06`) using the **service role key**, and apply the side effect:
     - renewal / initial / certification-only → set the member's credential `status='active'`, `expires_at = now + 2 years`.
     - `certification-sync` subscription → set `sync_enabled=true`.
     - annual provider fee → set provider `status='approved'`, `renews_at = now + 1 year`.
   - Idempotent on Stripe `event.id` (store processed event ids; ignore duplicates).
6. **Success / cancel pages:** `/checkout/success` confirms by reading the session (server-side) and shows next steps (e.g., CEU email reminder); `/checkout/cancel` offers to retry.
7. **Webhook local testing:** document `stripe listen --forward-to localhost:3000/api/stripe/webhook` in a `STRIPE_TESTING.md`.

## Constraints
- Prices ALWAYS from catalog data — never inline literals in components or API.
- Webhook route must read the **raw** request body (no JSON pre-parse) and must run on the Node runtime (`export const runtime = 'nodejs'`).
- Use the Stripe API version pinned by the installed SDK; set it explicitly in `lib/stripe.ts`.
- Test mode only until live keys + go-live are confirmed (log in DECISIONS.md).
- Do NOT store card data; Checkout handles PCI.

## Done when
- `seed-stripe.ts` creates all 11 products/prices in Stripe test mode and writes the price map.
- `/store` lists all 11 with correct prices; each `/store/[slug]` renders description + includes.
- A test purchase of a one-time item AND the `$15/mo` subscription both complete via Checkout test cards.
- The webhook verifies signature, writes a `payments` row, applies the correct credential side effect, and is idempotent on replay.
