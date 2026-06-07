# DECISIONS.md

Log every autonomous judgment call here. One row per decision.

| # | Decision | Reason | Reversible? | File(s) touched |
|---|----------|--------|-------------|-----------------|
| 1 | Frontend lives in `frontend/` subdirectory of the existing repo | Keeps the new Next.js app isolated from the existing static portal/admin files already in this repo; set Vercel root dir to `frontend/` | yes | `frontend/**` |
| 2 | Hand-built lightweight UI components (button via cva) + a custom mobile drawer instead of running the shadcn/ui CLI | More reliable in a non-interactive build; follows the same patterns and dependencies (cva, clsx, tailwind-merge, lucide-react) | yes | `components/ui/*`, `components/site-header.tsx` |
| 3 | Dropped the four 12MB embedded-raster "SVG" assets; use the 129KB ABCAC JPG as the brand/hero image + a typographic wordmark in the header | The SVGs are JPEGs wrapped in SVG (48MB total) — too heavy and not clean logos | yes | `public/brand/`, `components/site-header.tsx` |
| 4 | Pinned `next@14.2.35` | 14.2.15/.33 carried a flagged security advisory; .35 is patched | yes | `package.json` |
| 5 | Header "Book an Audit" CTA → `/contact` | No booking URL provided yet | yes | `lib/nav.ts` |
| 6 | Contact set = PO Box 83165, Phoenix AZ 85071 · 480-980-1770 · abcac@abcac.org | Assumed-current set per instructions (older PO Box 3266 / 602-251-8548 not used) | yes | `lib/site-config.ts` |
| 7 | Disabled the `react/no-unescaped-entities` ESLint rule | Apostrophes in ported verbatim copy are valid JSX text; entity-encoding real wording hurts readability | yes | `.eslintrc.json` |
| 8 | Public login uses Supabase email+password (no magic link) | Matches the existing portal/admin auth method; account creation stays in the management track | yes | `app/login/page.tsx` |
| 9 | Content pages port the substantive copy, deduplicated, into structured sections (raw source files repeat nav/services blocks) | Faithful to wording while producing clean, usable pages; no invented marketing copy | reorg only | `app/(site)/**` |
| 10 | `/account` codes against the assumed `members/credentials/payments` contract and degrades gracefully (hides/explains) if tables are absent | No schema work allowed on the frontend track; backend owns those tables | yes | `app/(portal)/account/page.tsx` |
| 11 | Created `/faq` from IC&RC exam facts + renewal basics (no FAQ source file) | Footer links to FAQ; instructions allow a minimal generated FAQ | yes | `app/(site)/faq/page.tsx` |
| 12 | Per-credential eligibility hours ported for all 7 credentials from the source page | Source specified them; faithful detail | reorg only | `app/(site)/initial-certification/page.tsx` |
| 13 | Front-end is now the PRIMARY site; the existing static member portal is co-hosted under `/portal` (and `/portal/admin`) via `public/portal/` + next.config rewrites | User directive: make the front-end primary and add a Member Portal button. One deployment serves both; portal keeps its own Supabase auth | yes | `frontend/public/portal/**`, `next.config.mjs` |
| 14 | Header right side = "Member Portal" (primary) + "Book an Audit" (secondary); removed the separate Login/My Account link | Member Portal is the entry to the full portal app; reduces clutter | yes | `components/site-header.tsx`, `lib/nav.ts` |
| 15 | Member Portal URL is `NEXT_PUBLIC_PORTAL_URL` (default `/portal`) | Allows pointing to a portal subdomain later without code changes | yes | `lib/nav.ts`, `.env.example` |
| 16 | Added a darker `--accent-strong` token for small eyebrow text (gold-on-light failed WCAG AA) + skip-to-content link | Accessibility | yes | `globals.css`, `tailwind.config.ts`, components, layouts |

## ⚠️ Vercel: make the front-end primary (one setting)
Set the Vercel project **Root Directory = `frontend/`** (Project Settings → General → Root Directory) and add the env vars from `frontend/.env.example`. After that, the domain serves the Next.js site; the member portal is reachable at `/portal`. The old root static site is then bypassed.

## Open items needing human confirmation
(Move here anything you could not resolve. Keep building around it with a stated assumption.)

- [ ] Stripe keys provided in `.env.local`? (test mode first) — code is ready; run `scripts/seed-stripe.ts` once keys are set.
- [ ] Supabase project ref + exact column names for `members` / `credentials` / `payments` / `contact_messages` confirmed against the management-panel build. The webhook + account page assume the contract in `instructions/06`; mismatches need the column names aligned. **Backend dependency:** these tables must exist for payment attribution and the account surface to populate.
- [ ] Booking URL for the header "Book an Audit" CTA (currently → `/contact`).
- [x] Contact details: using PO Box 83165 / 480-980-1770 / abcac@abcac.org (assumed current).
- [x] `Certification Sync` modeled as a recurring $15/mo subscription.
- [ ] Confirm guest-checkout email reconciliation policy (guest payments write `member_id = null`; webhook logs them for later reconciliation by email).
