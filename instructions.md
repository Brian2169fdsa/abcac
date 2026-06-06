# ABCAC Member Portal — FRONTEND Build Instructions (Claude Code)

> **Scope: FRONTEND ONLY.** The member-portal backend + admin/management panel already exist on Supabase (separate track). This build **connects to** that backend — it does **NOT** create, migrate, or redesign any database schema. If the frontend needs a table/column that isn't there, log it as a dependency in `DECISIONS.md` for the backend track; do not build it here.
>
> Read this whole file first, then work the phases in order. Reference data (real copy, products, logos) is in the uploaded `reference/` folder.

## Stack (pinned — do not substitute)
- Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui
- Supabase JS client (connect to EXISTING project — never create a new one, never run migrations)
- Stripe Checkout + webhook (the webhook is a Next.js API route inside this frontend app)
- Deploy: Vercel · Fonts: **Sora** (headings) + **Source Sans Pro** (body) via `next/font/google`

## Golden rules
1. Run autonomously. Where a decision is needed, pick the sensible default and log it in `DECISIONS.md`.
2. Commerce data = `reference/products.json` (never hand-type prices). Copy = `reference/content/*.txt` (port real wording, don't invent).
3. Never reintroduce Duda placeholders: `10 Street Name`, `555-555-5555`, `myemail@mailservice.com` must grep to zero.
4. Backend is read/connect only. No schema changes. Secrets in `.env.local`.

## The 6 confirm/fill items (assume + log, don't block)
1. Stripe keys in `.env.local` (assume **test mode**).
2. Supabase project = the existing portal project (env-provided). Connect, don't create.
3. Contact details — assume: **ABCAC, PO Box 83165, Phoenix, AZ 85071 · 480-980-1770 · abcac@abcac.org**.
4. Certification Sync — assume **$15/month subscription** ("$15/month forward").
5. Brand hex — derive from `reference/assets/` logo; use working palette below until confirmed.
6. Repo — add the frontend into the existing portal repo if present; else scaffold fresh.

## Out of scope
Admin/management panel · DB schema or migrations · Duda junk routes (`seo-influencers`, `so-what-s-seo-anyway`, `why-seo-loves-branding`, `my-post`, default `/category/*`). Blog = low priority stub.

---

# Phase 1 — Scaffold & Connect
1. Scaffold (or add a `(site)` group to the existing repo and reuse its Supabase client):
   `npx create-next-app@latest abcac-frontend --typescript --tailwind --app --src-dir --import-alias "@/*"`
   then `npx shadcn@latest init` and add: `button card input label dialog sheet sonner separator`.
   Install: `@supabase/supabase-js @supabase/ssr stripe`.
2. Fonts via `next/font/google`: Sora → `--font-sora` (display), Source_Sans_3 → `--font-body`; map in Tailwind (`fontFamily.display`, `fontFamily.sans`).
3. Move `reference/assets/*` → `public/brand/` with clean names (`abcac-logo`, `icrc-logo`, `hero`). Log rename map.
4. `src/lib/supabase/{server,client}.ts` using `@supabase/ssr` — **connect to existing project** via env. Reuse the repo's client if one exists.
5. `src/lib/stripe.ts` (server Stripe instance, pinned apiVersion) + publishable key for browser.
6. Copy `reference/products.json` → `src/data/products.json`; `src/lib/catalog.ts` with typed `Product`, `getProducts()`, `getProductBySlug()`.
7. `.env.local` + `.env.example`:
   `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `STRIPE_SECRET_KEY` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` · `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY (optional)`

**Done when:** `npm run dev` boots clean, Sora renders on an `<h1>`, `catalog.ts` returns all 11 products at correct prices, Supabase + Stripe clients import without error.

---

# Phase 2 — Design System
Working color tokens (Tailwind + CSS vars; override with real logo hex once sampled):
`--bg:#faf9f9 --surface:#ffffff --ink:#1c2430 --brand:#1f3a5f --brand-600:#16304f --accent:#c8a04a --muted:#5b6573 --line:#e7e5e3 --success:#1f7a4d`
Type: Sora 600/700 for h1–h3; Source Sans 400/600 body (line-height 1.6); h1 `clamp(2.25rem,4vw,3.25rem)`.
Component kit in `src/components/`: `section`, `stat-card`, `service-card`, `product-card`, `price-tag` (formats `$15.00 /mo`, `$500.00 /yr`, one-time), `cta-button`, `page-hero`, `trust-badge` (IC&RC logo + reciprocity line). Icons: `lucide-react`. WCAG AA contrast, focus-visible rings, semantic landmarks. Mobile-first (correct at 375px).

**Done when:** a dev-only `/styleguide` renders every component, one token change restyles the whole site, `price-tag` formats all three billing types correctly.

---

# Phase 3 — Global Layout
**Header** (`site-header.tsx`, client for mobile drawer): logo → `/`; nav in this exact order — `Home (/)` · `CEU (/ceu)` · `Choose Your Cert Path (/choose-your-cert-path)` · `Initial Certification (/initial-certification)` · `Certification Renewal (/certification-renewal)` · `IC&RC (/ic-rc)` · `Reciprocity (/reciprocity)` · `Testing (/testing)` · `Sync Your Certs (/store/certification-sync)` · `Contact Us (/contact)`; right CTA **"Book an Audit"** → `/contact` (until booking URL given); mobile = shadcn `sheet`; sticky w/ scroll shadow. Auth-aware "My Account"/"Login" (wired in Phase 6).
**Footer:** real contact block (item #3 above); links `Sync Your Certs · FAQ · Blog`; IC&RC member-board line; "© 2026 Arizona Board for Certification of Addiction Counselors (ABCAC). All rights reserved. Unauthorized use of content, logos, or materials is strictly prohibited."
Single source: `lib/nav.ts` (nav array used by desktop+mobile) and `lib/site-config.ts` (contact details used by footer/contact/receipts).
**Eradicate placeholders:** `10 Street Name`, `555-555-5555`, `myemail@mailservice.com`, any "City Name"/"Zip Code"/lorem.

**Done when:** header+footer on every page, mobile drawer works at 375px, all nav links resolve, repo grep for the three placeholder strings = 0 hits, contact details identical in footer and `/contact` from `site-config`.

---

# Phase 4 — Content Pages (port real copy from `reference/content/`)
| Route | Source file |
|---|---|
| `/` Home | `HOME.txt` |
| `/choose-your-cert-path` | `choose-your-cert-path.txt` |
| `/initial-certification` | `initial-certification.txt` (largest) |
| `/certification-renewal` | `certification-renewal.txt` |
| `/ceu` | `ceu.txt` |
| `/ic-rc` | `ic-rc.txt` |
| `/reciprocity` | `reciprocity.txt` |
| `/testing` | `newpage.txt` |
| `/remote-or-inperson` | `remote-or-inperson.txt` |
| `/initial-or-renewal` | `initial-or-renewal-of-cert.txt` |
| `/contact` | `contact-us.txt` |
| `/store`, `/store/[slug]` | `store.txt` + `products.json` (Phase 5) |
| `/blog` | `blog.txt` (low-priority stub) |

**Verbatim blocks:** Hero "Setting the Standard for Addiction Counselor Certification in Arizona." · Trust "Trusted by 1,000+ certified addictions counselors".
Home stat band (4): `1200+` Certified Professionals in Arizona / `57` IC&RC Member Boards / `100%` Ethics Compliance Rate (since 2022) / `$150` Standard Recertification Fee.
Services grid (4): Certification & Credentialing → `/initial-certification`; Exam Registration & Support → `/testing`; Recertification & Continuing Education → `/certification-renewal`; Reciprocity → `/reciprocity`.
Credential levels: CAC, CADAC, AADC, CCS, CCJP, CPRS, CPS.
IC&RC exam facts: CBT at IQT centers; 150 questions (125 scored + 25 pretest); 3 hours; retake after min 90 days.

**Rules:** keep substance verbatim (reorganize into headings is fine, rewording is not); every fee mentioned deep-links to its `/store/[slug]` with price from catalog; set per-page `<title>`/meta from each file's TITLE/META header.

**Done when:** all routes render real content from nav; Home shows exact hero + 4 stat cards + 4 service cards with working links; every payment reference links to a live product.

---

# Phase 5 — Store & Stripe (commerce)
Catalog (source of truth = `products.json`; modes below):
| Slug | Price | Mode |
|---|---|---|
| initial-certification-full-application-exam-fee | $375.00 | payment |
| initial-certification-full-application-exam-fee-remote-proctored-exam | $425.00 | payment |
| certification-certification-only-fee-already-passed-icrc-exam | $150.00 | payment |
| certification-renewal-2-year-credential-renewal-fee | $150.00 | payment |
| certification-sync | $15.00 | subscription (month) |
| testing-for-licensure-with-azbbhe | $225.00 | payment |
| testing-for-licensure-with-azbbhe-remote-proctored-exam | $275.00 | payment |
| ceu-workshop-endorsement-up-to-8-contact-hours | $250.00 | payment |
| ceu-workshop-endorsement-9-15-contact-hours | $375.00 | payment |
| ceu-workshop-endorsement-more-than-15-contact-hours | $500.00 | payment |
| annual-credential-fee-approved-ceu-providers | $500.00 | subscription (year) |

1. `scripts/seed-stripe.ts` (tsx): idempotent upsert of Stripe Product+Price per item (lookup by `metadata.slug`; cents = price×100, usd; recurring interval month/year for the two subs). Write resulting `price_id` to `src/data/stripe-price-map.json`.
2. `/store`: `product-card` grid grouped by category; intro from `store.txt`.
3. `/store/[slug]`: name, `price-tag`, description + includes from `products.json`, "Proceed to Payment" → checkout API. Certification/testing items capture **credential level** (select) + **exam mode**; CEU items show "Submit materials to abcac@abcac.org — 4-week review" (carry as metadata).
4. `app/api/stripe/checkout/route.ts` (POST): resolve price_id; create Checkout Session (`mode` from catalog), success `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, cancel `/checkout/cancel`; metadata `slug, product_name, credential_level, exam_mode, member_id, ceu_note`; if authed set `customer_email`/`client_reference_id`. Return `{url}`.
5. `app/api/stripe/webhook/route.ts` (POST, `runtime='nodejs'`, RAW body, verify `STRIPE_WEBHOOK_SECRET`): handle `checkout.session.completed` + `invoice.paid`. On success, write to the **existing** backend `payments` table via service-role client and apply the side effect on the existing `credentials` rows (renewal/initial → status active, expires_at +2yr; sync → sync_enabled true; annual provider → approved, +1yr). **If a needed table/column is absent, do NOT create it — log it in DECISIONS.md as a backend dependency and no-op gracefully.** Idempotent on `event.id`.
6. `/checkout/success` (reads session server-side, shows next steps + CEU reminder) and `/checkout/cancel` (retry).
7. `STRIPE_TESTING.md`: document `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

**Done when:** seed creates all 11 in test mode; `/store` shows all 11 at catalog prices; a one-time item AND the $15/mo sub both complete with test card `4242…`; webhook verifies signature, writes payment, applies side effect, idempotent on replay.

---

# Phase 6 — Auth & Member Surface (connect to existing backend — NO schema work)
Connect to the existing Supabase backend the management panel owns. **Read/write only against tables that already exist.** No migrations, no new tables. If something's missing, log it as a backend dependency and degrade gracefully (hide that UI section).
1. Auth: match the method the admin panel already uses (Supabase magic-link or email+password) via `@supabase/ssr` cookie sessions. Routes `/login`, `/logout`, callback. Do not introduce a second auth system.
2. Middleware: protect `(portal)` group; unauth → `/login?next=…`.
3. `/account`: profile (read/update own `members` row), credential status cards (level, status badge, expires_at, days left), per-credential **Renew** deep-link to the matching store product with `member_id` prefilled, payment-history table, Certification Sync toggle (reflects `sync_enabled`) + "Manage subscription" via `/api/stripe/portal`.
4. Header auth state wired (My Account/Logout vs Login).
5. Checkout↔member: authed checkout passes `member_id`/`client_reference_id` so the webhook attributes the payment. Guest checkout allowed (member_id null; reconcile by email — log).
6. Contact form `/contact` → `app/api/contact/route.ts`: if `RESEND_API_KEY` set, email `abcac@abcac.org`; else write to an existing messages table if present, otherwise email-only. Success msg "Thank you for contacting us. We will get back to you as soon as possible." / error "Oops, there was an error sending your message. Please try again later."
7. `/api/stripe/portal`: billing-portal session for the logged-in customer.
Service-role key is server-only (webhook/portal); never in the client bundle. Respect existing RLS.

**Done when:** member logs in, sees credential status + payment history + Sync toggle; authed checkout attributes the payment to the right member; renewal flips credential to active w/ fresh expires_at (against existing tables); contact form works with correct messages; no schema was created (any gaps logged as backend dependencies).

---

# Phase 7 — Acceptance / Done-When (must all pass)
**Build:** `npm run build` zero type/lint errors; `npm run dev` no console errors.
**Pages:** every Phase-4 route renders real copy; Home hero + 4 stat cards + 4 service cards correct; one h1/page; titles/meta set; no Duda junk routes.
**Placeholders (hard fail):** `grep -rniE "555-555-5555|myemail@mailservice\.com|10 Street Name|City Name|lorem ipsum" src/` = 0. Real contact in footer + `/contact` from `site-config`.
**Commerce:** seed made 11 products; `/store` prices match `products.json`; each detail page shows description+includes; one-time + $15/mo + $500/yr all check out (test); success/cancel work.
**Webhook/data:** signature verified; payment row written to existing table; renewal flips credential; recurring `invoice.paid` extends; idempotent on replay; missing-table cases logged not created.
**Auth/portal:** `/account` gated; member sees status/history/Sync; authed checkout attributes member; RLS respected (member A can't read B); contact form sends/persists.
**Responsive/a11y:** correct at 375/768/1280; mobile drawer; axe = no critical violations on Home, a content page, `/store`, `/store/[slug]`, `/account`; keyboard-reachable w/ visible focus.
**Hand-off:** `DECISIONS.md` complete (assumptions + backend dependencies); `.env.example` complete; `STRIPE_TESTING.md` present; Vercel preview deploys; finish with a summary of what shipped + exact values needed to flip Stripe test→live.
