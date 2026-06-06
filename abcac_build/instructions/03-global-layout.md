# 03 — Global Layout (Header, Footer, Nav)

## Context
Every public page shares one header and one footer. The old Duda site leaks **placeholder contact data** that must never reappear. There are also two conflicting contact sets; use the assumed-current one and flag the other.

## Task
Build `site-header.tsx` and `site-footer.tsx`, wire them into the `(site)` layout, and eradicate all Duda placeholders.

## Build Steps
1. **Header** (`components/site-header.tsx`, client component for mobile menu):
   - Left: ABCAC logo (`/brand/abcac-logo.svg`) linking to `/`.
   - Primary nav, in this exact order:
     `Home (/)` · `CEU (/ceu)` · `Choose Your Cert Path (/choose-your-cert-path)` · `Initial Certification (/initial-certification)` · `Certification Renewal (/certification-renewal)` · `IC&RC (/ic-rc)` · `Reciprocity (/reciprocity)` · `Testing (/testing)` · `Sync Your Certs (/store/certification-sync)` · `Contact Us (/contact)`
   - Right: primary CTA button **"Book an Audit"** (link to `/contact` until a booking URL is provided — log assumption).
   - Mobile: shadcn `sheet` drawer with the same links. Sticky header, subtle shadow on scroll.
2. **Footer** (`components/site-footer.tsx`):
   - Contact block (REAL): **ABCAC, PO Box 83165, Phoenix, AZ 85071** · **480-980-1770** · **abcac@abcac.org**
   - Quick links: `Sync Your Certs` · `FAQ` · `Blog`
   - IC&RC trust line + badge: "ABCAC is an independent member board of the International Certification & Reciprocity Consortium (IC&RC)."
   - Legal: "© 2026 Arizona Board for Certification of Addiction Counselors (ABCAC). All rights reserved. Unauthorized use of content, logos, or materials is strictly prohibited."
3. **Layout:** `app/(site)/layout.tsx` wraps children with header + `<main>` + footer.
4. **Placeholder eradication:** ensure NONE of these strings exist anywhere in the codebase or rendered output:
   - `10 Street Name, City Name Country, Zip Code`
   - `555-555-5555`
   - `myemail@mailservice.com`
   - any "City Name", "Zip Code", lorem-style filler
5. **Account entry:** header shows "My Account" / "Login" depending on Supabase auth state (wire fully in `instructions/06`; stub the link now to `/account`).

## Constraints
- Single source for nav items: define a `NAV` array in `lib/nav.ts` and consume in both desktop and mobile — do not duplicate the list.
- Real contact details come from one config object (`lib/site-config.ts`) — used by footer, contact page, and Stripe receipts. Single source of truth.
- Do NOT invent social links; only add icons for accounts that actually exist (none confirmed → omit, log).

## Done when
- Header + footer render on every `(site)` page; mobile drawer works at 375px.
- A repo-wide grep for `555-555-5555`, `myemail@mailservice.com`, and `10 Street Name` returns **zero** matches (this is also checked in `instructions/07`).
- All nav links resolve (even if the target page is a stub at this stage).
- Contact details appear identically in footer and on `/contact`, sourced from `lib/site-config.ts`.
