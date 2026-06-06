# 02 — Design System

## Context
The old site uses **Sora** (headings) + **Source Sans Pro** (body) on a warm off-white base (`#faf9f9`). It reads as a clean, trustworthy government/credentialing board. Match that feel: calm, authoritative, legible — not flashy.

## Task
Establish design tokens and a small reusable component kit that every page composes from.

## Build Steps
1. **Color tokens** (Tailwind theme + CSS vars). Use this working palette until official brand hex is confirmed from the logo SVGs (then update tokens in one place and log it):
   ```
   --bg:        #faf9f9   /* page background */
   --surface:   #ffffff   /* cards */
   --ink:       #1c2430   /* primary text (deep navy-charcoal) */
   --brand:     #1f3a5f   /* ABCAC navy — primary actions, headers */
   --brand-600: #16304f
   --accent:    #c8a04a   /* muted gold — badges, accents, sparing use */
   --muted:     #5b6573   /* secondary text */
   --line:      #e7e5e3   /* borders / dividers */
   --success:   #1f7a4d
   ```
   Sample the actual navy/gold from `public/brand/abcac-logo.svg`; if it differs, prefer the logo values and note in `DECISIONS.md`.
2. **Type scale:** `display` = Sora 600/700 for h1–h3; `sans` = Source Sans 3 400/600 for body & UI. h1 clamp(2.25rem,4vw,3.25rem); generous line-height on body (1.6).
3. **Component kit** in `src/components/`:
   - `section.tsx` — vertical-rhythm wrapper (`py-16 md:py-24`, max-w-6xl, px gutters). Optional `eyebrow`, `title`, `intro` props.
   - `stat-card.tsx` — big number + label + sublabel (for the homepage stat band).
   - `service-card.tsx` — icon + title + description + optional link.
   - `product-card.tsx` — name, price (formatted from cents/dollars), short description, "Pay / Checkout" button → `/store/[slug]`.
   - `price-tag.tsx` — formats price + billing suffix (`/mo`, `/yr`, or one-time).
   - `cta-button.tsx` — primary (brand) + secondary (outline) variants on shadcn `button`.
   - `page-hero.tsx` — title + intro + optional image, reused across interior pages.
   - `trust-badge.tsx` — renders the IC&RC logo with the reciprocity line.
4. **Icons:** `lucide-react` (already available via shadcn). No emoji in UI chrome.
5. **Accessibility:** color contrast ≥ WCAG AA; focus-visible rings on all interactive elements; semantic landmarks (`<header><main><footer>`).

## Constraints
- No CSS-in-JS libraries; Tailwind + CSS vars only.
- Keep the component kit small — compose pages from these, don't one-off bespoke markup per page.
- Gold accent is for emphasis only (badges, the occasional underline) — never large fills.
- Mobile-first; every component must look right at 375px and scale up.

## Done when
- A `/styleguide` dev-only page renders every component with sample data and passes an axe accessibility check (no critical violations).
- Changing a single color token updates the whole site.
- `PriceTag` renders `$15.00 /mo`, `$500.00 /yr`, and `$375.00` (one-time) correctly from catalog data.
