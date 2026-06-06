# 01 — Context & Stack

**Role:** You are a senior full-stack engineer building a production Next.js frontend on Vercel against an existing Supabase backend, in an autonomous Claude Code session.

## Context
- **Client:** Arizona Board for Certification of Addiction Counselors (ABCAC) — an IC&RC member board that certifies addiction counseling professionals in Arizona.
- **What ABCAC does:** initial certification, 2-year renewals, IC&RC exam registration/testing, AZBBHE licensure testing support, reciprocity transfers, and CEU workshop endorsement. Credentials: CAC, CADAC, AADC, CCS, CCJP, CPRS, CPS.
- **Current site:** a Duda site at abcac.org with a basic "store" that just collects payments. You are replacing it.
- **This build:** the public site + commerce + member-facing portal surface. The **management/admin panel is a separate track** already in progress on the same Supabase backend.

## Task
Scaffold a Next.js (App Router, TypeScript, Tailwind, shadcn/ui) project, wire fonts and env, and establish the repo conventions every later phase depends on.

## Build Steps
1. **Scaffold** (skip if a portal repo already exists — instead add a `(site)` route group into it and reuse its Supabase client):
   ```bash
   npx create-next-app@latest abcac-portal --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
   cd abcac-portal
   npx shadcn@latest init
   npx shadcn@latest add button card input label dialog sheet sonner separator
   npm i @supabase/supabase-js @supabase/ssr stripe
   ```
2. **Fonts:** load `Sora` (display) and `Source Sans Pro` (Source_Sans_3) via `next/font/google` in `src/app/layout.tsx`; expose as CSS vars `--font-sora`, `--font-body`; map in Tailwind theme (`fontFamily.display`, `fontFamily.sans`).
3. **Copy assets:** move `reference/assets/*` into `public/brand/` (rename to clean kebab-case, e.g. `abcac-logo.svg`, `icrc-logo.png`, `hero.jpg`). Record the rename map in `DECISIONS.md`.
4. **Supabase clients:** create `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` using `@supabase/ssr`. If the portal repo already has these, reuse them.
5. **Stripe client:** `src/lib/stripe.ts` exporting a configured `Stripe` instance (server-only) and the publishable key for the browser.
6. **Env:** create `.env.local` and `.env.example` with the exact names below.
7. **Catalog import:** copy `reference/products.json` to `src/data/products.json` and create `src/lib/catalog.ts` with a typed `Product` interface + `getProducts()` / `getProductBySlug()`.

## Required env vars (exact names)
```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=          # optional, for contact form email; otherwise write to Supabase
```

## Target repo structure
```
src/
  app/
    (site)/            # public pages — layout with header+footer
      page.tsx                     # Home
      choose-your-cert-path/
      initial-certification/
      certification-renewal/
      ceu/
      ic-rc/
      reciprocity/
      testing/
      remote-or-inperson/
      initial-or-renewal/
      contact/
      store/
      store/[slug]/                # product detail
      checkout/success/
      checkout/cancel/
    (portal)/          # auth-gated member surface (instructions/06)
      account/
    api/
      stripe/checkout/route.ts
      stripe/webhook/route.ts
      contact/route.ts
  components/          # site-header, site-footer, product-card, stat-card, section, etc.
  lib/                 # supabase/, stripe.ts, catalog.ts, utils.ts
  data/                # products.json
public/brand/          # logo + images
```

## Constraints
- TypeScript strict mode on. No `any` in committed code.
- Do NOT create a new Supabase project. Reuse the management-panel project (env-provided).
- Do NOT commit `.env.local`. Keep `.env.example` complete and key-less.
- Use server components by default; client components only where interactivity requires it.

## Done when
- `npm run dev` boots with no type errors and fonts load (Sora visible on an `<h1>`).
- `src/lib/catalog.ts` returns all 11 products from `products.json` with correct prices.
- Supabase + Stripe clients import without runtime error.
- `.env.example` lists every variable above; `DECISIONS.md` has the asset rename map.
