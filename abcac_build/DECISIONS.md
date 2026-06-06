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

## Open items needing human confirmation
(Move here anything you could not resolve. Keep building around it with a stated assumption.)

- [ ] Stripe keys provided in `.env.local`? (test mode first)
- [ ] Supabase project ref / schema for `members` + `credentials` confirmed against the management-panel build?
- [ ] Correct contact details: PO Box 85071 / 480-980-1770 set (assumed current) vs older PO Box 3266 / (602) 251-8548 set
- [ ] `Certification Sync` — recurring $15/mo subscription (assumed) vs one-time $15?
