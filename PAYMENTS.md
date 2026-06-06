# ABCAC Payments (Stripe) — Setup

Members can pay invoices online via **Stripe Checkout**. Renewal and
certification-sync requests create an application that an admin turns into an
invoice (in the admin console), which the member then pays from the
**Invoices & Receipts** page.

## Flow
1. Admin creates an invoice for a member (admin console → Create Invoice), or a
   member requests a renewal/sync which prompts the admin to invoice them.
2. Member clicks **Pay Now** on the Invoices page.
3. The portal calls the **`create-checkout`** Edge Function, which creates a
   Stripe Checkout Session and returns its URL; the browser redirects to Stripe.
4. After payment, Stripe calls the **`stripe-webhook`** Edge Function, which
   marks the invoice `paid` (this is the source of truth — the browser redirect
   only shows a toast).

## Setup
1. **Create a Stripe account** and grab your secret key (`sk_test_…` to start).
2. **Deploy the functions:**
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
3. **Set the secrets:**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   ```
4. **Register the webhook** in the Stripe dashboard → Developers → Webhooks:
   - Endpoint URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret and set it:
     ```bash
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
     ```
5. **Test** with Stripe test cards (e.g. `4242 4242 4242 4242`).

## Graceful degradation
If `STRIPE_SECRET_KEY` is not set, `create-checkout` returns
`{ "error": "payments_not_configured" }` and the portal shows a friendly
"contact ABCAC to pay" message instead of erroring — so the rest of the portal
works before payments are switched on.

## Security notes
- Stripe secret, webhook secret, and the Supabase service-role key live **only**
  as Edge Function secrets — never in `index.html` or `portal.js`.
- `create-checkout` reads the invoice amount server-side from the database, so a
  member cannot tamper with the charged amount.
- The webhook verifies Stripe's signature before trusting any event.
