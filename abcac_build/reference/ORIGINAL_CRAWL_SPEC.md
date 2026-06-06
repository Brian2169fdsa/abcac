# ABCAC Member Portal — Frontend Rebuild Spec

**Source site:** https://www.abcac.org (Duda-built, fully crawled)
**Target:** Next.js frontend on Vercel = the public face of the ABCAC member portal (Supabase backend), with Stripe replacing Duda's store.
**Crawl date:** 2026-06-06 — 34 URLs in sitemap, 24 real pages kept, 10 Duda template-junk pages dropped.

---

## 1. What this package contains

| File / folder | Purpose |
|---|---|
| `ABCAC_BUILD_SPEC.md` | This document — the master build brief for Claude Code |
| `products.json` | Machine-readable catalog of all 11 store items (Stripe-ready) |
| `content/*.txt` | Clean copy for every real page (nav/footer boilerplate stripped) |
| `assets/` | Brand assets pulled from the site (logo SVGs, IC&RC logo, hero image) |
| `extracted.json` | Raw structured extraction (titles, meta, headings, full text, prices) for all 34 URLs |

---

## 2. Brand & design tokens

- **Heading font:** `Sora` (Google Fonts)
- **Body font:** `Source Sans Pro` (Google Fonts)
- **Base background:** `#faf9f9` (warm off-white)
- **Logo:** ABCAC wordmark/shield — see `assets/` SVGs (`Untitled+design+_283/284/286/287_29.svg`) and `g8mVT8s4Q8eUpyl1TN3Z_ABCAC+3.v2.jpg`
- **Partner logo:** IC&RC 4-color logo (`assets/ICRC-4c-logo-500px-480x165-1.png`) — used as a trust badge
- Duda did not expose a named color palette in CSS vars. Pull exact brand colors by sampling the logo SVGs; treat navy/blue + clean white as the working palette until confirmed with the real logo.

---

## 3. Navigation (global header)

Primary nav (in order):
`Home` · `CEU` · `Choose Your Cert Path` · `Initial Certification` · `Certification Renewal` · `IC&RC` · `Reciprocity` · `Testing` · `Sync Your Certs` · `Contact Us`

Header CTA button: **Book an Audit**

> ⚠️ **Replace Duda placeholder contact block.** The template still shows fake details
> (`10 Street Name, City Name Country, Zip Code` / `555-555-5555` / `myemail@mailservice.com`)
> in the account widget area. Use the REAL footer info everywhere:
> **ABCAC, PO Box 83165, Phoenix, AZ 85071 · 480-980-1770 · abcac@abcac.org**
> (Note: an older listing shows PO Box 3266 / (602) 251-8548 — use the 85071 / 480-980-1770 set, which is current on the live store/footer.)

Footer links: `Sync Your Certs` · `FAQ` · `Blog`
Footer legal: "© 2026 Arizona Board for Certification of Addiction Counselors (ABCAC). All rights reserved. ABCAC is an independent member board of the International Certification & Reciprocity Consortium (IC&RC). Unauthorized use of content, logos, or materials is strictly prohibited."

---

## 4. Page map to build

Keep (real pages — copy in `content/`):

| Route | Page | Notes |
|---|---|---|
| `/` | Home | Hero, stat band, services grid, contact form |
| `/choose-your-cert-path` | Choose Your Cert Path | Decision hub: first-time vs renewing |
| `/initial-certification` | Initial Certification | Largest content page (~23k chars) — eligibility, credentials, process |
| `/certification-renewal` | Certification Renewal | 2-year renewal, $150, CEU docs |
| `/ceu` | CEU | CEU endorsement tiers + provider info |
| `/ic-rc` | IC&RC | Exam structure, reciprocity consortium |
| `/reciprocity` | Reciprocity | Transfer in/out of AZ |
| `/testing` (`/newpage`) | Testing | AZBBHE + ABCAC + IC&RC testing; the live "Testing" nav item points to `/newpage` |
| `/remote-or-inperson` | Remote or In-Person | Exam mode explainer |
| `/initial-or-renewal-of-cert` | Initial or Renewal | Routing helper page |
| `/contact-us` | Contact Us | Contact form + real address block |
| `/store` | Store / Payments | **REBUILD with Stripe** (see §5) |
| `/blog` + posts | Blog | Optional; the only real post is generic — low priority |

Drop (Duda template demo junk — do NOT rebuild):
`/seo-influencers`, `/so-what-s-seo-anyway`, `/why-seo-loves-branding`, `/my-post`,
and the default store categories `/category/{accessories,apparel,material,online-classes,personal-training,sports-mat}` (these are leftover fitness-template categories with no real products).

---

## 5. Store → Stripe integration (the core commerce work)

The Duda store is just a payment-collection page. Replace it 1:1 with Stripe Checkout, driven by `products.json`.

**Catalog (11 items, USD):**

| Product | Price | Billing |
|---|---|---|
| Initial Certification – Full Application & Exam Fee | $375.00 | one-time |
| Initial Certification – Full Application & Exam Fee (Remote Proctored) | $425.00 | one-time |
| Certification Certification-Only Fee – Already Passed IC&RC Exam | $150.00 | one-time |
| Certification Renewal – 2-Year Credential Renewal Fee | $150.00 | one-time |
| Certification Sync | $15.00 | **per month (subscription)** |
| Testing w/ ABCAC &/or AZBBHE – In Person | $225.00 | one-time |
| Testing w/ ABCAC &/or AZBBHE – Remote Proctored | $275.00 | one-time |
| CEU Workshop Endorsement (Up to 8 Contact Hours) | $250.00 | one-time |
| CEU Workshop Endorsement (9–15 Contact Hours) | $375.00 | one-time |
| CEU Workshop Endorsement (More Than 15 Contact Hours) | $500.00 | one-time |
| Annual Credential Fee – Approved CEU Providers | $500.00 | **per year (subscription)** |

**Implementation notes for Claude Code:**
- Seed Stripe Products/Prices from `products.json` (a `scripts/seed-stripe.ts` that loops the catalog; one-time → `price` with no recurring, `Certification Sync` → recurring `month`, `Annual Credential Fee` → recurring `year`).
- Use **Stripe Checkout Sessions** (mode `payment` for one-time, `subscription` for the two recurring items) — least PCI burden, fastest to ship.
- Webhook (`/api/stripe/webhook`) on `checkout.session.completed` + `invoice.paid` → write the purchase/renewal to Supabase against the member's record (this is the portal tie-in: a paid renewal should flip the member's credential `status`/`expires_at`).
- Each product page (`/product/{slug}`) keeps its full description + "includes" bullets from `products.json`; CTA "Button" becomes "Pay / Checkout".
- Capture at checkout: member name, email, **credential level** (CAC, CADAC, AADC, CCS, CCJP, CPRS, CPS) and, for testing/initial items, **exam mode** (in-person AZ center Phoenix/Flagstaff vs remote proctored). Pass as Checkout `metadata` so the webhook can route it in the portal.
- CEU endorsement items: instruct buyer to email materials to `abcac@abcac.org`; review turnaround 4 weeks — surface this on the success page.

---

## 6. Key reusable content blocks (verbatim from site)

**Hero tagline:** "Setting the Standard for Addiction Counselor Certification in Arizona."
**Trust line:** "Trusted by 1,000+ certified addictions counselors"

**Homepage stat band (4 cards):**
- `1200+` — Certified Professionals in Arizona — "And growing every year across clinical, prevention, and peer support domains."
- `57` — IC&RC Member Boards — "Through IC&RC, ABCAC offers credential reciprocity with boards in 57 U.S. and international jurisdictions."
- `100%` — Ethics Compliance Rate — "Maintained among active certificate holders since 2022."
- `$150` — Standard Recertification Fee — "Keep your credentials active affordably every two years."

**Services grid:**
- *Certification & Credentialing* — Apply for initial certification in addiction counseling, peer recovery, prevention, or supervision, recognized by IC&RC.
- *Exam Registration & Support* — ABCAC provides IC&RC certification exams and supports licensure testing through AZBBHE.
- *Recertification & Continuing Education* — Maintain credentials with clear recertification pathways and access to endorsed CEU opportunities.
- *Reciprocity* — Move your credential to Arizona or transfer to another IC&RC member board with streamlined reciprocity services.

**Credentials offered (use across cert pages & Stripe metadata):**
CAC (Certified Addiction Counselor), CADAC (Certified Alcohol & Drug Abuse Counselor), AADC (Advanced Alcohol & Drug Counselor), CCS (Certified Clinical Supervisor), CCJP (Certified Criminal Justice Professional), CPRS (Certified Peer Recovery Specialist), CPS (Certified Prevention Specialist).

**IC&RC exam facts (from FAQ/IC&RC page):** Computer-Based Testing at IQT centers; 150 multiple-choice questions (125 scored + 25 pretest); 3 hours; retake after a minimum of 90 days (may be longer per member board).

---

## 7. Build sequence (suggested for Claude Code)

1. Scaffold Next.js (App Router) + Tailwind on Vercel; wire Sora + Source Sans Pro; drop in logo assets.
2. Build global layout (header nav, footer, real contact block) — fix all Duda placeholders.
3. Port static content pages from `content/*.txt` (Home → cert pages → IC&RC/Reciprocity/Testing → Contact).
4. Build `/store` + `/product/[slug]` from `products.json`.
5. Stripe: seed script → Checkout sessions → webhook → Supabase write-back (credential status on paid renewal/initial).
6. Auth/portal tie-in: gate "My Account" + renewal history behind Supabase auth; link purchases to member records.
7. Replace contact form action with portal/Supabase (or Resend/email) — Duda's form endpoint won't carry over.

---

## 8. Things to confirm with the client before launch
- Correct mailing address & phone (PO Box 85071 set vs older 3266 set).
- Whether `Certification Sync` is truly a recurring $15/mo subscription or a one-time $15 (site copy says "$15/month forward").
- Real brand hex values from the official logo files.
- Whether the blog is being retained or retired.
