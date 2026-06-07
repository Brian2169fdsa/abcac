# Integration Assessment — Website ⇄ Member Portal

How to make the public website (Next.js, `frontend/`) and the member portal
(currently the static `index.html` + admin console) work as one seamless system
across the certification and recertification journeys.

## TL;DR
Today they are **two apps with two different data models, two auth sessions, and
two Stripe integrations** that don't talk to each other. To make them seamless
we need **one Supabase project, one data model, one login session, and one
payment path** — and to turn the cert/recert "download this PDF" steps into
**online forms** that write to that shared database. Recommended path: fold the
member portal into the Next.js app as the gated `(portal)` section.

---

## Current state (the disconnect)

| Concern | Public website (`frontend/`) | Member portal (`index.html`) + admin |
|---|---|---|
| Framework | Next.js 14 (React, SSR) | Static HTML + vanilla JS |
| Supabase project | env-configured (not yet set) | **`ajgqqfggdctmcqhbmptb`** (live) |
| Data model | assumes `members`, `credentials`, `payments`, `contact_messages` | uses `profiles`, `certifications`, `ceu_records`, `documents`, `applications`, `invoices`, … |
| Auth/session | `@supabase/ssr` **cookies** | supabase-js **localStorage** |
| Stripe | Next.js API routes → `payments` + `credentials` | Edge Functions → `invoices` |

**The problem in one line:** the website's payment webhook and account page write
to tables (`payments`, `credentials`) that **don't exist** in the portal's
database — so a purchase on the site never reaches the member's portal record,
and a login on one side isn't recognized on the other.

---

## Target architecture (seamless)

### 1. One Supabase project
Point the front-end at the **existing portal project `ajgqqfggdctmcqhbmptb`**.
Never create a second project. (Set `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` to that project.)

### 2. One data model — the portal's schema is canonical
The portal's schema is the real, richer one (already has RLS + admin + storage).
Map the website's assumed tables onto it, with **additive-only** changes:

| Website assumed | Use instead (portal) | Action |
|---|---|---|
| `members` | `profiles` (`profiles.id` = `auth.users.id`) | none — drop the separate members concept; `member_id` = auth user id |
| `credentials.level/status/expires_at/sync_enabled` | `certifications.cert_type/status/expiration_date` | align column names in code; **add** `sync_enabled` (migration 004) |
| `payments` | *(new)* `payments` table for website store purchases | **add** `payments` (migration 004), linked to `profiles` (+ optional `application_id`/`certification_id`) |
| `contact_messages` | route to email (Resend) or **add** `contact_messages` | additive or email-only |

Admin-issued bills stay in `invoices`; spontaneous **store** purchases (initial
fee, exam fee, CEU endorsement) go in the new `payments` table.

### 3. One login session
Same project means one user table. For true SSO between the two front-ends,
**unify into the Next.js app** (cookie session everywhere). A static-portal +
Next-app split keeps two session stores (localStorage vs cookies) that don't
share automatically — workable only with a fragile token hand-off. Unifying is
the clean answer.

### 4. One Stripe path
Consolidate on the **Next.js** `/api/stripe/*` routes (the store lives there).
The webhook writes the canonical `payments` row and applies the credential
side-effect on `certifications`. Retire the portal's duplicate
`create-checkout`/`stripe-webhook` Edge Functions (or keep only for
admin-issued `invoices`).

---

## The journeys, end-to-end (what "seamless" looks like)

**Initial certification**
1. Website → *Choose Your Cert Path* → *Initial Certification* → pay the
   application & exam fee (Stripe Checkout).
2. Webhook records the `payment` against the member (`profiles.id`).
3. Member is routed into the portal → **online application form** (credential
   level, education, experience) + **document uploads** (transcript, hours log)
   → writes `applications` + `documents`, linked to the payment.
4. Admin console reviews → approves → issues a `certification`.
5. Member sees the active credential + downloads the certificate in the portal.

**Recertification**
1. Website → *Certification Renewal* → pay the $150 renewal fee.
2. Webhook records the payment.
3. Portal → **online recert form** + CEU records + CE certificate uploads →
   `applications` (type renewal) + `ceu_records` + `documents`.
4. Admin reviews CEUs → approves → `certification` renewed (+2 years).

**Connection points that must exist**
- Single identity (one Supabase user = one `profiles` row) across site + portal.
- Payment ↔ application linkage (checkout metadata carries `member_id` and the
  cert context so admin sees "paid").
- Status visible in both the site's `/account` and the portal.
- The application/recert **forms replace the current PDF "Download Form" steps**.

---

## Recommended plan (phased)

**Phase A — Unify the backbone**
- Point the front-end at `ajgqqfggdctmcqhbmptb`.
- Additive migration `004`: `payments` table + `certifications.sync_enabled`.
- Rewrite the front-end webhook/account to read/write `profiles` /
  `certifications` / `payments`. Consolidate Stripe to the Next.js path.

**Phase B — One app, one session (recommended)**
- Rebuild the portal's surfaces as Next.js `(portal)` pages (account,
  certifications + certificate download, CEU tracker, documents, applications,
  renewal, supervision) reading the same tables — one cookie session, shared
  components, shared header/footer.
- Retire the static `index.html` portal (kept at `/portal` only until parity).

**Phase C — Online forms (the cert/recert paperwork)**
- Build structured application & recertification forms (replacing PDFs),
  prefilled from `profiles`, with document upload, tied to the matching payment.

**Phase D — Polish**
- Unified notifications/emails, admin coverage of the new flows, full QA.

---

## Decisions needed
1. **Unify the portal into the Next.js app (recommended)** vs **keep two apps and
   bridge sessions**? Unifying is more work now but is the only truly seamless,
   maintainable end state.
2. Confirm the single Supabase project is **`ajgqqfggdctmcqhbmptb`**.
3. Store purchases → new **`payments`** table (recommended) vs reuse `invoices`?
