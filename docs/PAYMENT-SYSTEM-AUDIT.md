# Payment System Audit — Why Checkout Is Broken + How the Whole System Fits Together

> Audited 2026-07-19 against the live deployment (abcac.vercel.app) and the live Supabase
> database. Test suite on this branch: **955/955 green**. The code is healthy — the failure
> is deployment configuration, and it is verified, not guessed.

---

## 1. Why the payment system is not working (verified on the live site)

**Every checkout on the live site fails with HTTP 500 `payment_form_save_failed`**
("We could not securely save your payment form"). Probed directly:

```
POST https://abcac.vercel.app/api/stripe/checkout  →  {"error":"payment_form_save_failed"}  HTTP 500
```

**Root cause: the live Supabase database is missing the three newest tables.** The recent
form-digitization work (commits `6d3ce29`…`8684080`) added migrations 037–039 and made the
checkout API *require* saving a `payment_submissions` intake row before it will create a
Stripe session (`src/app/api/stripe/checkout/route.ts:122-139`). Those tables were never
created on the live database. Verified via the live REST API:

| Table | Migration | Live DB status |
|---|---|---|
| `application_signer_requests` | 037 | **missing** (`PGRST205` not found) |
| `testing_requests` | 038 | **missing** |
| `payment_submissions` | 039 | **missing** |
| `payments`, `profiles`, … (001–036) | — | present |

This one gap breaks **three** features at once: all Stripe checkouts, the exam
pre-registration workflow (`/account/testing`), and the e-sign packet flow (`/account/forms`).

**The fix is a 2-minute paste.** Run [`docs/apply-missing-migrations-037-039.sql`](./apply-missing-migrations-037-039.sql)
in the Supabase SQL editor (project `ajgqqfggdctmcqhbmptb`). All statements are additive and
safe to re-run. Checkout should work immediately afterward — no redeploy needed.

### What is already configured correctly (also verified live)

- **Stripe keys are set, in TEST mode** — the price lookup passes (the request got past
  `price_not_found`), and the test price map (`src/data/stripe-price-map.test.json`) is populated.
- **The webhook secret is set** — `POST /api/stripe/webhook` returns `400 invalid signature`,
  not `payments_not_configured`.

### Remaining go-live config (after the migration fix)

1. **Live Stripe** — `src/data/stripe-price-map.live.json` is `{}`. When switching to live keys, run
   `STRIPE_SECRET_KEY=sk_live_... npm run seed:stripe`, commit the generated live map, and swap the
   Vercel env vars to the live key pair. Until then the site can only take test-card payments.
2. **Webhook endpoint** — confirm the endpoint registered in the Stripe dashboard is
   `https://<domain>/api/stripe/webhook` (events: `checkout.session.completed`, `invoice.paid`),
   **not** the legacy Supabase Edge Function `stripe-webhook` (invoice-only; writes no `payments`
   rows). Recommend deleting the Edge Functions `stripe-webhook` and `create-checkout` outright —
   the Next.js routes replaced both.
3. **Domain cutover** — `abcac.org` still serves the **old Duda site** (published 2026-07-01);
   the new platform lives at `abcac.vercel.app`. Payments "on the site" won't exist for real
   visitors until DNS points at Vercel.
4. **Branch → main** — this branch is ~30 commits ahead of `main` (homepage redesign, cert flows,
   digital forms, payment-submission linking). Merge to `main` so production deploys track it.
5. **Portal preview gate** — every `/account/*` page is still behind the "coming soon" preview
   code (`src/middleware.ts:25-34`, default code in `src/lib/portal-preview.ts`). Members cannot
   reach the portal — including the post-payment "Go to My Account" button on the success page —
   until this gate is removed for launch.

---

## 2. How the payment system works (the map)

One pipeline, four entry points, one source of truth:

```
Member/guest                                    Stripe                    Supabase
────────────                                    ──────                    ────────
Store / cert-payment page ─┐
Invoice "Pay now" button ──┤   POST /api/stripe/checkout
Exam pre-registration ─────┤   1. save payment_submissions row (intake form)
Cert-sync / reciprocity ───┘   2. create Checkout Session (metadata links everything)
                                        │
                                        ▼
                               Stripe-hosted checkout
                                        │  checkout.session.completed / invoice.paid
                                        ▼
                               POST /api/stripe/webhook  (signature-verified, idempotent)
                                 • writes `payments` row  ← THE record admins + members see
                                 • marks payment_submissions paid
                                 • flips the linked record: invoice → paid,
                                   testing_request → paid (+ staff task + member notification),
                                   reciprocity → paid, cert-sync application → under_review
                                 • saves stripe_customer_id on the profile
                                 • emails receipt to payer + alert to ABCAC staff
```

- **Member side:** `/account` dashboard and `/account/invoices` read the member's own `payments`
  and `invoices` rows (RLS-scoped). Payment history appears as soon as the webhook fires.
- **Admin side:** `/admin/finance` shows revenue totals, per-product/per-month breakdowns, and
  every payment with its attached intake form (`/admin/finance/payments/[id]`). `/admin/invoices`
  creates bills; per-member billing actions can manually mark paid/void. CSV export at
  `/api/admin/export/payments`. All of it reads the database rows the webhook wrote — nothing
  reads Stripe live, which is why a mis-registered webhook silently empties the finance view.
- **Payment gating:** exam registration is the one flow that genuinely gates on payment
  (requests only enter the admin queue after the webhook marks them paid). Account approval,
  application approval, and cert issuance have **no** payment precondition in code — staff
  judgment is the gate.

This design is right: webhook as single source of truth, an intake form attached to every
charge so Finance can process without guessing, idempotent event handling, RLS on every table.
It does not need re-architecting — it needs the config above, plus the polish below.

---

## 3. Recommendations to make the digital system genuinely smooth

Ranked; 1–3 are this-week items, the rest are fast follows.

1. **Apply migrations 037–039** (the fix above). Everything else is secondary.
2. **Retire the legacy Stripe Edge Functions** (`supabase/functions/stripe-webhook`,
   `create-checkout`) and verify the registered webhook endpoint. Two parallel payment
   implementations is the biggest "confusing system" risk you have.
3. **Fix the onboarding submit bug** — `src/components/onboarding-flow.tsx:76-82` still inserts
   self-reported certifications from the browser, which RLS has blocked since migration 013.
   Any new signup who reports an existing credential gets an error and **cannot complete
   onboarding** → they never reach approved status → they never see payments in the portal.
   (Self-reported numbers now belong in `profiles.submitted_cert_numbers`.)
4. **Close the loop after renewal/sync payments.** Today a paid renewal or cert-sync just sits
   until staff manually edit the certification. Minimum smooth version: webhook creates a
   `member_tasks` entry for staff (it already does for testing) **and** the member sees a
   "payment received — in review" status instead of silence. Full version: enable the guarded
   automation workflows (`docs/ship/03-automation-rollout.md`) so approval auto-extends dates.
5. **Handle guest payments.** Checkout permits guests; their `payments` rows have
   `member_id = null`, appear in no portal, and the success page tells them to visit an account
   they don't have. Either require login for member-priced products, or backfill: when a new
   account's email matches orphaned payments, attach them at approval time.
6. **Give admins a refund path.** There is no refund capability anywhere (the automation rule
   is escalate-only, and `payment_submissions.status='refunded'` is never written). Even a
   "Refund in Stripe dashboard, then mark refunded here" button keeps Finance truthful.
7. **Populate `payments.application_id`.** The member applications page correlates payments to
   applications by product slug (heuristic); the FK column has existed since migration 004 and
   the webhook has the linked record in metadata — write it.
8. **Small integrity fixes:** webhook returns 200 even when the `payments` insert fails
   (silent finance data loss — return 500 on that one failure so Stripe retries); reconcile the
   `'paid'` vs `'succeeded'` status drift between the dashboard reader and the webhook writer;
   `invoices.currency` is read in `invoice-checkout` but the column doesn't exist.

## 4. Smoke test once migrations are applied

1. Store → any product → fill payment form → Stripe test card `4242 4242 4242 4242`.
2. Confirm: success page → `payments` + `payment_submissions` rows exist → receipt + staff email →
   payment visible in `/admin/finance` **and** the member's `/account/invoices`.
3. `/account/testing` → submit an exam pre-registration → pay → confirm it lands in
   `/admin/testing` as **paid** with a staff task.
4. Admin invoice: create for a test member → member pays from `/account/invoices` → webhook flips
   it to paid automatically.
