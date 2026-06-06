# CLAUDE.md — ABCAC Member Portal Frontend

> Project memory. Read this first, every session. Then follow `instructions/` in numeric order.

## What you are building
The public-facing frontend for the **ABCAC Member Portal** — the Arizona Board for Certification of Addiction Counselors. This frontend **replaces the existing Duda site at abcac.org** and becomes the front door of the member portal. The portal **backend / management panel is being built separately** (Supabase + admin UI). Your job is the public site + commerce + the member-facing portal surface that reads/writes the same Supabase backend.

## Stack (pinned — do not substitute)
- **Next.js 14+** App Router, **TypeScript**, **Tailwind CSS**
- **shadcn/ui** for primitives (button, card, input, dialog, sheet)
- **Supabase** (existing project — shared with the management panel; do NOT create a new project)
- **Stripe** Checkout + webhooks for all payments
- Deploy target: **Vercel**
- Fonts: **Sora** (headings) + **Source Sans Pro** (body) via `next/font/google`

## Golden rules (autonomous build)
1. **Run autonomously.** Do not stop to ask questions. Where a decision is needed, pick the sensible default and log it in `DECISIONS.md`.
2. **Log every judgment call** in `DECISIONS.md` (a row per decision: what, why, reversible?).
3. **Source of truth for commerce** = `reference/products.json`. Never hand-type prices.
4. **Source of truth for copy** = `reference/content/*.txt`. Port the real wording; do not invent marketing copy.
5. **Never reintroduce Duda placeholders.** The old site leaks `10 Street Name`, `555-555-5555`, `myemail@mailservice.com`. These must not appear anywhere in output. (See `instructions/03`.)
6. **Do not modify the Supabase schema** owned by the management panel without writing the intended change to `DECISIONS.md` first and using additive migrations only.
7. **Secrets live in `.env.local`** (see `instructions/01` for exact var names). Never hardcode keys.

## Build order
```
instructions/00-START-HERE.md            ← orientation + the 6 things to confirm
instructions/01-context-and-stack.md     ← repo scaffold, env, conventions
instructions/02-design-system.md         ← tokens, fonts, components
instructions/03-global-layout.md         ← header, footer, nav, placeholder fixes
instructions/04-content-pages.md         ← all static pages from reference/content
instructions/05-store-and-stripe.md      ← catalog, Checkout, subscriptions, webhook
instructions/06-auth-and-portal.md       ← Supabase auth + member/credential tie-in
instructions/07-acceptance-qa.md         ← done-when checklist (must pass before "done")
```

## Reference corpus
- `reference/products.json` — 11 store items, prices, billing type, metadata fields
- `reference/content/*.txt` — clean copy for all 24 real pages (nav/footer stripped)
- `reference/assets/` — ABCAC logo SVGs, IC&RC badge, hero image
- `reference/sitemap.xml` — original URL map
- `reference/ORIGINAL_CRAWL_SPEC.md` — the human-readable crawl summary (background)

## Definition of done (high level)
All pages render, all 11 products check out through Stripe (test mode), the webhook writes purchases to Supabase against the member record, auth gates the portal surface, and `instructions/07` checklist passes 100% — including a clean placeholder scan.
