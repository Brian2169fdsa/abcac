# QA Report — ABCAC Frontend

Status against `abcac_build/instructions/07-acceptance-qa.md`. Items marked
**needs live creds** require Stripe test keys and the shared Supabase project,
which aren't available in the build environment — the code is in place and the
build is green.

## Build & types
- [x] `npm run build` succeeds — 0 type errors, 0 ESLint errors.
- [x] All 26 routes compile; `/store/[slug]` prerenders all 11 products.
- [~] Edge-runtime warning from `@supabase/ssr` in middleware (uses `process.version`) — non-blocking; build succeeds.

## Pages & content
- [x] Every route in instructions/04 renders with real, deduplicated copy from `reference/content`.
- [x] Home: exact hero tagline, 4-card stat band, 4-card services grid — links resolve.
- [x] Interior pages use the shared `PageHero`; single `<h1>` per page.
- [x] Per-page `<title>`/meta set.
- [x] No Duda junk routes created.

## Placeholder hygiene
- [x] `grep -rniE "555-555-5555|myemail@mailservice\.com|10 Street Name|City Name|lorem ipsum" src/` → **0 results**.
- [x] Real contact (PO Box 83165, Phoenix AZ 85071 · 480-980-1770 · abcac@abcac.org) in footer + `/contact`, both from `lib/site-config.ts`.

## Commerce (Stripe)
- [x] Catalog drives all prices (`products.json` → `catalog.ts`); no inline price literals.
- [x] `/store` lists all 11 grouped by category; `/store/[slug]` shows description + includes; cert/testing capture credential level; CEU shows the 4-week notice.
- [x] Checkout API resolves price ids, sets payment vs subscription mode, attributes authed members, and degrades gracefully when unconfigured.
- [x] Webhook verifies signature (raw body, node runtime), writes `payments`, applies credential side effects, idempotent on `stripe_event_id`.
- [ ] **needs live creds:** run `seed-stripe.ts`; complete a one-time + $15/mo + $500/yr test purchase; confirm webhook writes + idempotency. See `STRIPE_TESTING.md`.

## Auth & portal
- [x] `/account` gated by middleware → `/login?next=…` when unauthenticated.
- [x] Login (email+password), logout, and Stripe billing-portal route implemented.
- [x] Account shows credential cards, payment history, and Sync management; degrades gracefully if backend tables are absent.
- [ ] **needs live creds:** verify member attribution end-to-end and RLS (member A cannot read member B) against the shared Supabase project.

## Responsive & a11y
- [x] Mobile-first; custom drawer at <1280px; semantic landmarks; focus-visible rings; AA-oriented tokens.
- [ ] **manual:** run an axe scan on Home, a content page, `/store`, `/store/[slug]`, `/account` in a browser.

## Hand-off
- [x] `DECISIONS.md` updated with assumptions + open backend dependencies.
- [x] `.env.example` complete; `STRIPE_TESTING.md` present.
- [ ] Set env vars in Vercel; set project root directory to `frontend/`; deploy preview.

## To flip Stripe test → live
1. Replace `sk_test_*` / `pk_test_*` with live keys; re-run `seed-stripe.ts` against live mode.
2. Register the production webhook endpoint (`/api/stripe/webhook`) for `checkout.session.completed` + `invoice.paid`; set the live `STRIPE_WEBHOOK_SECRET`.
3. Confirm the Supabase `members/credentials/payments/contact_messages` tables and column names; set `SUPABASE_SERVICE_ROLE_KEY`.
4. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
