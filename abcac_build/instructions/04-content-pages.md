# 04 — Content Pages

## Context
All real copy lives in `reference/content/*.txt` (nav/footer boilerplate already stripped — re-add it via the global layout, don't paste it back into page bodies). Build each route by porting its source file into well-structured sections using the `instructions/02` component kit.

## Task
Build every public content page. Use the real wording. Do not write new marketing copy; you may lightly reorganize into headings/sections for layout, but keep the substance verbatim.

## Route → source file map
| Route | Source file | Notes |
|---|---|---|
| `/` (Home) | `content/HOME.txt` | Hero + stat band + services grid + contact CTA. Blocks below. |
| `/choose-your-cert-path` | `content/choose-your-cert-path.txt` | Decision hub: first-time vs renewing → links to relevant pages/products. |
| `/initial-certification` | `content/initial-certification.txt` | Largest page — eligibility, credential levels, process steps. |
| `/certification-renewal` | `content/certification-renewal.txt` | 2-year renewal, $150, CEU documentation. CTA → renewal product. |
| `/ceu` | `content/ceu.txt` | CEU endorsement tiers + approved-provider info. CTA → CEU products. |
| `/ic-rc` | `content/ic-rc.txt` | IC&RC consortium, exam structure, reciprocity. |
| `/reciprocity` | `content/reciprocity.txt` | Transfer in/out of AZ. |
| `/testing` | `content/newpage.txt` | The live "Testing" nav item is the `newpage` source. AZBBHE + ABCAC + IC&RC testing. CTA → testing products. |
| `/remote-or-inperson` | `content/remote-or-inperson.txt` | Exam-mode explainer (links to in-person vs remote products). |
| `/initial-or-renewal` | `content/initial-or-renewal-of-cert.txt` | Routing helper. |
| `/contact` | `content/contact-us.txt` | Contact form + real address block (see `instructions/06` for form handling). |
| `/store` | `content/store.txt` | Rebuilt as the Stripe catalog — see `instructions/05`. |
| `/blog` | `content/blog.txt` | LOW PRIORITY — stub route; only the generic post exists. |

## Verbatim reusable blocks (use exactly)
**Hero tagline:** "Setting the Standard for Addiction Counselor Certification in Arizona."
**Trust line:** "Trusted by 1,000+ certified addictions counselors"

**Homepage stat band — 4 `stat-card`s:**
- `1200+` — Certified Professionals in Arizona — "And growing every year across clinical, prevention, and peer support domains."
- `57` — IC&RC Member Boards — "Through IC&RC, ABCAC offers credential reciprocity with boards in 57 U.S. and international jurisdictions."
- `100%` — Ethics Compliance Rate — "Maintained among active certificate holders since 2022."
- `$150` — Standard Recertification Fee — "Keep your credentials active affordably every two years."

**Services grid — 4 `service-card`s:**
- *Certification & Credentialing* — "Apply for initial certification in addiction counseling, peer recovery, prevention, or supervision, recognized by IC&RC." → `/initial-certification`
- *Exam Registration & Support* — "ABCAC provides IC&RC certification exams and supports licensure testing through AZBBHE." → `/testing`
- *Recertification & Continuing Education* — "Maintain your credentials with clear recertification pathways and access to endorsed CEU opportunities." → `/certification-renewal`
- *Reciprocity* — "Move your credential to Arizona or transfer to another IC&RC member board with our streamlined reciprocity services." → `/reciprocity`

**Credential levels (use on cert pages + as Stripe metadata options):**
CAC (Certified Addiction Counselor) · CADAC (Certified Alcohol & Drug Abuse Counselor) · AADC (Advanced Alcohol & Drug Counselor) · CCS (Certified Clinical Supervisor) · CCJP (Certified Criminal Justice Professional) · CPRS (Certified Peer Recovery Specialist) · CPS (Certified Prevention Specialist)

**IC&RC exam facts (for `/ic-rc` and `/testing`):** Computer-Based Testing at IQT centers; 150 multiple-choice questions (125 scored + 25 pretest); 3-hour limit; retake after a minimum of 90 days (may be longer per member board).

## Build Steps
1. For each route, read its source file, structure it into `Section` blocks with clear h2/h3 headings, and place a relevant CTA (`/store/[slug]`) where the copy references a fee/payment.
2. Build a shared `page-hero` for interior pages (title + 1–2 sentence intro pulled from the source's opening lines).
3. Cross-link: cert pages link to their matching store products; `/remote-or-inperson` links to the in-person vs remote product variants.
4. Add `metadata` (title + description) per route using each source file's `TITLE`/`META` header lines.
5. Set up the `FAQ` footer link target — if no FAQ source is present, create a minimal `/faq` from the IC&RC exam facts + renewal basics and log it.

## Constraints
- Keep substance verbatim; layout/heading reorganization is allowed, rewording is not.
- Every fee mentioned in copy must deep-link to the corresponding Stripe product, prices sourced from the catalog (never typed inline).
- Drop all Duda template junk pages (see `instructions/00` scope fence).

## Done when
- All routes in the map render with real content and resolve from the header/footer nav.
- Home shows the exact hero, the 4-card stat band, and the 4-card services grid with working links.
- Every payment reference in body copy links to a live `/store/[slug]`.
- Per-page `<title>`/meta set from source headers.
