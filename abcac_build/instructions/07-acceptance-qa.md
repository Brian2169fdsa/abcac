# 07 — Acceptance & QA

## Context
This is the gate. The build is "done" only when every box below is checked. Run it end-to-end before declaring completion. Capture results in a `QA-REPORT.md`.

## Task
Verify the full build against functional, commerce, integration, and hygiene criteria.

## Checklist

### Build & types
- [ ] `npm run build` succeeds with zero type errors and zero ESLint errors.
- [ ] `npm run dev` boots clean; no console errors on any route.

### Pages & content
- [ ] Every route in `instructions/04` renders with real copy from `reference/content`.
- [ ] Home shows exact hero tagline, 4-card stat band, 4-card services grid — all links resolve.
- [ ] Interior pages use the shared `page-hero`; headings are semantic (single h1 per page).
- [ ] Per-page `<title>` and meta description set from source headers.
- [ ] No Duda template junk routes exist (seo-influencers, my-post, default categories, etc.).

### Placeholder hygiene (hard fail if any hit)
- [ ] `grep -rniE "555-555-5555|myemail@mailservice\.com|10 Street Name|City Name|lorem ipsum" src/` → **0 results**.
- [ ] Real contact details (PO Box 83165, Phoenix, AZ 85071 · 480-980-1770 · abcac@abcac.org) appear in footer + `/contact`, both sourced from `lib/site-config.ts`.

### Commerce (Stripe test mode)
- [ ] `seed-stripe.ts` created all 11 products + prices; price map written.
- [ ] `/store` lists all 11 with prices matching `products.json` exactly.
- [ ] Each `/store/[slug]` shows description + includes; certification/testing items capture credential level + exam mode.
- [ ] One-time item checks out with test card `4242 4242 4242 4242`.
- [ ] `Certification Sync` ($15/mo) creates a subscription; `Annual Credential Fee` ($500/yr) creates a yearly subscription.
- [ ] Success page confirms the order; cancel page offers retry.

### Webhook & data
- [ ] Webhook verifies signature; rejects unsigned/invalid.
- [ ] `checkout.session.completed` writes a `payments` row with correct amount, slug, metadata.
- [ ] Renewal/initial purchase flips credential `status='active'` with `expires_at = +2 years`.
- [ ] Subscription `invoice.paid` (recurring) extends correctly.
- [ ] Replaying the same Stripe event does NOT double-write (idempotent on `stripe_event_id`).

### Auth & portal
- [ ] `/account` gated; unauthenticated → `/login?next=…`.
- [ ] Logged-in member sees credential status, payment history, Sync toggle.
- [ ] Authenticated checkout attributes `payments.member_id` correctly.
- [ ] RLS: member A cannot read member B's rows (verified with two test users).
- [ ] Contact form sends/persists and shows the correct success message.

### Responsive & a11y
- [ ] Looks correct at 375px, 768px, 1280px; mobile nav drawer works.
- [ ] axe scan: no critical violations on Home, a content page, `/store`, `/store/[slug]`, `/account`.
- [ ] All interactive elements keyboard-reachable with visible focus.

### Hand-off
- [ ] `DECISIONS.md` complete — every assumption + open item logged.
- [ ] `.env.example` lists all vars; `STRIPE_TESTING.md` documents the listen command.
- [ ] `QA-REPORT.md` written with pass/fail per section and screenshots/links where useful.
- [ ] Vercel preview deploy succeeds; env vars set in the Vercel project.

## Done when
Every box above is checked and `QA-REPORT.md` shows a clean pass. Then summarize for the human: what shipped, what's in `DECISIONS.md` open items, and the exact list of values needed to flip Stripe from test → live.
