# 00 — START HERE

## How to use this package
1. Read `CLAUDE.md` (root) — it is your standing memory for this project.
2. Work through `instructions/01` → `07` in order. Each file is a self-contained build phase in the **Context → Task → Build Steps → Requirements → Constraints → Done when** pattern.
3. Pull all copy from `reference/content/*.txt` and all commerce data from `reference/products.json`. Do not invent either.
4. Append every judgment call to `DECISIONS.md`.
5. A phase is complete only when its **Done when** block is fully satisfied. Do not advance with a failing criterion; note blockers in `DECISIONS.md` and build around them.

## The 6 things to confirm/fill (don't block on these — assume + log)
You can build the entire site without human input. These are the only externally-supplied items. If absent, use the stated assumption and add an entry to `DECISIONS.md` → "Open items":

1. **Stripe keys** → `.env.local` (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`). Assume **test mode** until told otherwise. Build fully against test keys.
2. **Supabase project** → shared with the management panel. Assume existing `members` and `credentials` tables; if their exact columns aren't visible, code against the contract in `instructions/06` and flag for confirmation.
3. **Contact details** → assume current set: **ABCAC, PO Box 83165, Phoenix, AZ 85071 · 480-980-1770 · abcac@abcac.org**.
4. **Certification Sync billing** → assume **$15/month subscription** (site copy says "$15/month forward").
5. **Brand hex values** → derive from `reference/assets/` logo SVGs; use the working palette in `instructions/02` until the official hex is confirmed.
6. **Repo location** → if not already in a repo, scaffold at the current working directory; otherwise add the frontend into the existing portal repo per `instructions/01`.

## Scope fence (what is OUT of scope this session)
- Do **not** build the admin/management panel — that's the separate backend track.
- Do **not** migrate or redesign the Supabase schema (additive migrations only, logged).
- Do **not** rebuild Duda template junk: `/seo-influencers`, `/so-what-s-seo-anyway`, `/why-seo-loves-branding`, `/my-post`, and the default store categories (`/category/accessories|apparel|material|online-classes|personal-training|sports-mat`).
- Blog is **low priority** — stub the route, port later only if time allows.

## Macro definition of done
Public site live on Vercel preview, 11 Stripe products checking out in test mode, webhook writing to Supabase, portal surface gated by Supabase auth, and `instructions/07` checklist green.
