# GAP-ANALYSIS v2 — ABCAC platform state on `main`, post-sprint

> **Fresh assessment as of 2026-06-07**, after the sprint that shipped migrations through 021, public verification, the 360° admin member view, two-way messaging, account settings, reciprocity OUT/INTO, PDF (print) receipts, certificate file upload, signup cert numbers, and `cert_schedules`. The original `GAP-ANALYSIS.md` and `SCHEMA-CURRENT.md` are **historical** (pre-sprint) and should be read as such.
>
> Method: every claim cites a file/table. "Writes" = `insert`/`update`/storage `upload` against Supabase; "Reads" = server/client query against live schema. The Next.js app at `/account/*` + `/admin/*` is the **cutover target** (the static `public/portal/*` is legacy). `npm run build` was run once after adding only this doc and **passes clean** (exit 0).
>
> Migration note: the numbering jumps 018 → 021 (no `019`/`020` files exist). Sequence on disk: `001..018, 021`. Not a defect, just a gap in numbers.

---

## 1. "DONE WHEN" ACCEPTANCE CRITERIA (the 8 phase gates in `instructions.md`)

| # | Phase gate (Done-When) | Verdict | Evidence |
|---|---|---|---|
| 1 | **Scaffold & connect** — dev boots, Sora on h1, catalog returns 11 products, Supabase+Stripe import | **DONE** | `src/lib/catalog.ts` + `src/data/products.json` (now 12 entries incl. `icrc-reciprocity-transfer`); `src/lib/supabase/{server,client}.ts`, `src/lib/stripe.ts`; fonts in `src/app/layout.tsx`. `npm run build` green. |
| 2 | **Design system** — `/styleguide` renders kit, token-driven, `price-tag` 3 billing types | **DONE** | `src/app/styleguide/page.tsx`; `src/components/{section,stat-card,service-card,product-card,price-tag,cta-button,page-hero,trust-badge}.tsx`; `tailwind.config.ts` + `globals.css`. |
| 3 | **Global layout** — header+footer everywhere, mobile drawer, nav resolves, 0 placeholder strings, contact from `site-config` | **DONE** | `src/components/{site-header,site-footer,mega-menu}.tsx`; `src/lib/{nav,site-config}.ts`. Placeholder grep (`555-555-5555`/`10 Street Name`/`myemail@…`) = 0 hits in `src/`. |
| 4 | **Content pages** — all routes render real copy, home hero/4 stats/4 services, fees deep-link to store | **DONE** | `src/app/(site)/**` (home, initial-certification, certification-renewal, ceu, ic-rc, reciprocity, testing, contact, etc.). |
| 5 | **Store & Stripe** — seed makes 11, `/store` prices match, one-time + $15/mo check out, webhook verifies/writes/idempotent | **PARTIAL** | Code complete: `src/app/api/stripe/{checkout,webhook,portal,invoice-checkout}/route.ts`, idempotent on `stripe_event_id`. **BUT `src/data/stripe-price-map.json` is still `{}`** → `getPriceId()` undefined → checkout returns `503 price_not_found`. The seed (`scripts/seed-stripe.ts`) is a manual owner step that has **not** been run. Commerce is non-functional until then. |
| 6 | **Auth & member surface** — login, `/account` status+history+Sync, authed checkout attributes member, renewal flips credential, contact form, no schema invented | **DONE (w/ documented decision)** | `middleware.ts`, `src/app/{login,logout,signup,forgot,reset-password,auth/callback}`; `src/app/(portal)/account/page.tsx` (status cards, payment history, Sync). Decision (correct): paying a fee does **not** auto-grant/renew a credential — staff issue via `/admin` (`issue-cert-form.tsx`); the only automatic payment side effect is `sync_enabled` (`webhook/route.ts:153`). Contact form `src/app/api/contact/route.ts`. |
| 7 | **Acceptance/Done-When** — build zero errors, placeholders 0, commerce, webhook/data, auth/portal/RLS, a11y, hand-off | **PARTIAL** | Build clean; placeholders 0; RLS isolation present (009/011/013/014/017). Gated on the same Stripe-seed manual step (criterion 5) and on the manual deploy steps (§5 below). |
| 8 | **Cert Due-Dates engine + renewal-alerts automation** (the sprint's added scope: `cert_schedules`, `schedules.ts`, n8n `ABCAC-01-RENEWAL-ALERTS`) | **PARTIAL / mostly UNWIRED** | Table seeded (`016_cert_schedules.sql`), pure TS engine (`src/lib/schedules.ts`) + tests (`tests/schedules.test.ts`) exist, n8n JSON exists (`n8n/ABCAC-01-RENEWAL-ALERTS.json`). **But nothing consumes the engine**: no page/admin/edge-function imports `schedules.ts` or reads `cert_schedules`; renewal eligibility + reminders still hard-code 40 CEUs / 90-60-30 days; the n8n workflow calls a Supabase RPC `cert_renewal_candidates` that **does not exist in any migration**. See gaps #2, #3, #4 below. |

---

## 2. SURFACE-BY-SURFACE STATUS

### Member portal (`src/app/(portal)/account/**`)

| Surface | Wired | Weak / missing |
|---|---|---|
| **Personal Info / Profile** (`profile/page.tsx`, `profile-form.tsx`) | Writes `profiles` + `notification_preferences`; password change; profile-completeness % on `/account`. | None material. |
| **Employment** (`experience/page.tsx`, `EmploymentFields`) | Writes `employment_records`; **now has add + edit** (`EditEmploymentForm`). | No delete. Minor. |
| **Certificate & Wallet Card** (`certifications/page.tsx`, `certificate-actions.tsx`) | Reads `certifications`; print-to-PDF certificate + wallet card; **downloads admin-uploaded physical cert file** via signed URL when `certificate_url` set (018). | Cert/wallet are still browser print-to-PDF (no server-rendered binary) — acceptable per brief. |
| **Other Certifications** (`AddOtherCertForm`) | Writes `other_certifications` **incl. `doc_path` file upload** to `member-documents` (014). | No edit/delete; no preview link in member list (admin sees it). Minor. |
| **Apply (initial)** (`apply/page.tsx`, `member-application-form.tsx`) | Writes `applications` + uploads to `member-documents` + `documents` rows; attestation/e-sig. | Fee is separate store purchase (by design). Complete. |
| **Document Upload** (`documents/page.tsx`, `document-upload.tsx`) | Storage + `documents` rows; signed-URL view; admin request→fulfil loop (`010`). | Checklist is substring heuristic. Minor. |
| **CEU Tracker** (`ceus/page.tsx`, `ceu-compliance.ts`) | Writes `ceu_records`; **real computed KPIs** (40/3/3); admin approve/reject + status email. | KPI thresholds hard-coded, not from `cert_schedules` (gap #4). |
| **Renewal + Sync** (`renew/page.tsx`, `renewals/page.tsx`, `/account` Sync) | Renewal form writes `applications`; auto $150 invoice via `scheduled-reminders`; Sync = Stripe sub → `sync_enabled`. | Sync is a **flag, not a date-reconciliation engine** (`webhook:155` sets all certs); renewals page hard-codes 90-day/40-CEU, ignores `cert_schedules` (gaps #3, #4). |
| **Clinical Supervision** (`AddSupervisionForm`) | Writes `supervision_records` (keyed `supervisor_id`; member-as-supervisor). | **Member-as-supervisee NOT modeled** — table has no `member_id` column (001); admin's `supervisionAsMember` query returns empty (gap #6). Add-only. |
| **Name Change** (`NameChangeForm`) | Writes `name_change_requests` **incl. ID `doc_path` upload** to `name-change-docs`; admin preview now works. | Complete. |
| **Verification** (`requests/page.tsx`, `VerificationForm`) | **Dynamic "Certification to verify" select** (sets `cert_id`); writes `verification_requests`; **public site form** at `/verify` → `/api/verification`; **one-click admin Verified/Not-Verified + recipient email** (`decide-verification.ts`). | Public-form email is best-effort (needs Resend key). Largely DONE — this was the old #2 gap, now closed. |
| **Reciprocity** (`ReciprocityForm`) | Tailored OUT (with $150 fee + destination-board email) and INTO (no fee) flows; OUT approval emails destination board (`decide-request.ts:133`). | **$150 OUT payment loop is broken**: checkout isn't passed the request id, so `payment_status` never flips to `paid` (gap #5). |
| **Messages** (`messages/page.tsx`, `messages-panel.tsx`) | **Two-way** — member compose/reply (014 `guard_message_insert` + RLS), admin threads (`admin-messaging.tsx`), unread counts. | Complete. Was old #3 gap, now closed. |
| **Invoices & Receipts** (`invoices/page.tsx`, `pay-invoice-button.tsx`) | Reads `invoices`; Stripe pay; webhook mark-paid; **downloadable receipt** (`receipt-download.tsx`, print-to-PDF, correct org name). | Receipts are print-to-PDF, not binary PDF — acceptable. |
| **Account Settings** (`settings/page.tsx`, `notification-settings.tsx`) | Writes `notification_preferences`; `scheduled-reminders` respects `renewal_reminders` + `ceu_deadline_alerts`. | `abcac_announcements` / `icrc_updates` toggles still **dead** (no sender consumes them) — gap #7. |

### Admin (`src/app/(admin)/admin/**`)

| Surface | Wired | Weak / missing |
|---|---|---|
| **Dashboard / Reports / Finance / Compliance** | Real counts/revenue/exports. | — |
| **Approvals** (`approvals/page.tsx`, `approve-account.ts`) | Approve activates certs + emails credentials (username + login link, not password); shows `submitted_cert_numbers` (021). | — |
| **Members list + 360° detail** (`members/[id]/page.tsx`) | Reads **every** member surface defensively (`safeList`); inline issue-cert, request-doc, send-message, create-invoice, status/role controls. | `supervisionAsMember` is dead (no `member_id` col). |
| **Documents / CEUs / Applications** | Approve/reject + status emails. | — |
| **Requests** (`requests/page.tsx`) | Name-change (with ID preview), verification (one-click + email), reciprocity (approve→board email). | — |
| **Messaging** (`messaging/page.tsx`, `admin-messaging.tsx`) | Full two-way threads + unread badge. | — |
| **Create Invoice / Audit / Search** | Real. | — |
| **cert_schedules management** | **MISSING** — no admin UI/route/nav entry to view or edit `cert_schedules`; only `scripts/import-cert-schedules.ts` (service-role, manual) writes it. Gap #2. |

### Legacy static `public/portal/*`
Superseded by the Next.js `/account` surfaces above, which now meet or exceed every legacy surface. No remaining feature lives only in the static portal; treat static as decommissioned at cutover.

---

## 3. REMAINING REAL GAPS — RANKED (drives the next sprint)

1. **Stripe price map empty → all payments 503** *(operational blocker, owner step, S to unblock)*
   `src/data/stripe-price-map.json` is `{}`; `getPriceId()` returns undefined; `/api/stripe/checkout` returns `503 price_not_found`. Blocks every checkout incl. Sync, renewal fee, reciprocity OUT $150. Fix: run `scripts/seed-stripe.ts` against the Stripe account. Files: `src/data/stripe-price-map.json`, `scripts/seed-stripe.ts`, `src/lib/catalog.ts`.

2. **No admin management UI for `cert_schedules`** *(M)*
   The reference table (016) is only writable via `scripts/import-cert-schedules.ts` (manual, service-role). Owner cannot view/edit renewal-cycle / CEU rules in-app. Build `/admin/cert-schedules` (list + edit form, admin-gated; RLS already allows admin write). Files/tables: new `src/app/(admin)/admin/...`, `src/components/admin/...`, `admin-nav.tsx`, table `cert_schedules`.

3. **Renewal eligibility + reminders ignore `cert_schedules`** *(M)*
   `account/renewals/page.tsx` and `account/page.tsx` hard-code a 90-day window + `computeCompliance` hard-codes 40/3/3; `supabase/functions/scheduled-reminders/index.ts` hard-codes `REQUIRED_CEU_HOURS=40` + `REMINDER_DAYS=[90,60,30]`. None read `cert_schedules` or use `src/lib/schedules.ts`. Wire the engine in (per-credential cycle, CEU totals, grace, tiers). Files: `src/lib/schedules.ts` (exists, unused), `src/lib/ceu-compliance.ts`, `account/renewals/page.tsx`, `account/page.tsx`, `scheduled-reminders/index.ts`; table `cert_schedules`.

4. **CEU compliance is one-size-fits-all** *(S–M, subset of #3)*
   `src/lib/ceu-compliance.ts` assumes 40 total / 3 ethics / 3 cultural for everyone; CPRS/CPS differ in the seed (016). Parameterize `computeCompliance` by the member's `cert_schedules` row.

5. **Reciprocity OUT $150 payment loop is broken** *(S–M)*
   `ReciprocityForm` (`portal-forms.tsx:418`) posts only `{slug:'icrc-reciprocity-transfer'}` to `/api/stripe/checkout`. The checkout route (`checkout/route.ts`) doesn't accept/forward a `reciprocity_request_id`, and the webhook (`webhook/route.ts`) has no slug handler for reciprocity. So after a successful $150 payment, `reciprocity_requests.payment_status` / `stripe_session_id` are **never** updated — the fee shows "unpaid" forever and the admin can't see it as paid. Fix: pass the request id in metadata; have the webhook flip `payment_status='paid'`. Tables: `reciprocity_requests` (cols already exist from 017).

6. **Member-as-supervisee supervision not modeled** *(M)*
   `supervision_records` (001) has only `supervisor_id` + free-text `supervisee_name`; no `member_id`/FK linking a supervisee profile. The admin 360° view queries `supervisionAsMember` via `.eq("member_id", …)` — always empty (column doesn't exist). To support "this member is being supervised," add a nullable `member_id` (or a `supervision_authorizations` table the admin page already optimistically queries) + a member write path. Files/tables: new migration on `supervision_records` (or `supervision_authorizations`), `portal-forms.tsx`, `members/[id]/page.tsx`.

7. **n8n `ABCAC-01-RENEWAL-ALERTS` depends on a non-existent RPC** *(S–M)*
   `n8n/ABCAC-01-RENEWAL-ALERTS.json` calls `…/rest/v1/rpc/cert_renewal_candidates`, documented as joining certifications + profiles + `cert_schedules` + CEU progress + prefs (`CERT-DUE-DATES-ENGINE.md`). **That function/view is in no migration** — the workflow returns nothing until the SQL is written and applied. Either add the migration or drop n8n in favor of `scheduled-reminders` (which works but doesn't use `cert_schedules`). Files: new migration; `n8n/ABCAC-01-RENEWAL-ALERTS.json`.

8. **Dead alert toggles** *(S)*
   `abcac_announcements` and `icrc_updates` in `notification_preferences` are stored and shown (`notification-settings.tsx`) but **no sender reads them**. Either wire an announcement/IC&RC sender that respects them or hide the toggles. Files: `scheduled-reminders/index.ts` (or a new sender), `notification-settings.tsx`.

9. **Receipts/certificates are print-to-PDF, not binary PDF** *(M, only if a real PDF artifact is required)*
   `receipt-download.tsx` + `certificate-actions.tsx` open a print window. Functional and branded; flagged only because the brief language says "downloadable PDF." A server-rendered PDF (e.g. `@react-pdf` / headless) would close it if the owner wants attachable files. Files: `receipt-download.tsx`, `certificate-actions.tsx`, optional new API route.

10. **Email deliverability is entirely Resend-key-gated** *(S, ops)*
    Every transactional email (verification outcomes, reciprocity board notice, approval credentials, receipts, reminders) **no-ops silently without `RESEND_API_KEY`** (graceful by design). Until the key + verified `abcac.org` sending domain are set, no email is actually delivered. Files: `src/lib/email.ts`, `api/verification/route.ts`, `decide-*.ts`, both edge functions; env `RESEND_API_KEY` / `RESEND_FROM_EMAIL`.

11. **Edit/delete CRUD gaps** *(S, polish)*
    Other Certifications, Supervision, and most request rows are add-only (Employment now has edit). Low priority.

### Notes on previously-flagged gaps that are now CLOSED (do not re-do)
- Verification cluster (public form, cert select, one-click Verified/Not-Verified, recipient email) — **done** (`/verify`, `/api/verification`, `decide-verification.ts`).
- Two-way member↔admin messaging — **done** (014 + `messages-panel.tsx` + `admin-messaging.tsx`).
- Name-change ID upload + admin preview — **done** (`name-change-docs`, `NameChangeForm`).
- Other-certs file upload — **done** (014 `doc_path`).
- Downloadable receipts + **webhook org-name bug** — **done/fixed** (`receipt-download.tsx`; webhook now uses `siteConfig`).
- Reciprocity OUT/INTO tailored flows + board email — **done** (017, `ReciprocityForm`, `decide-request.ts`) — *except the OUT payment reconciliation (gap #5).*
- Certificate physical-file upload → member download — **done** (018, `issue-cert-form.tsx`, `certificate-actions.tsx`).
- Signup self-reported cert numbers + admin approval visibility + credentials email — **done** (021, `approve-account.ts`).

---

## 4. WHAT ALREADY WORKS — DO NOT REBUILD

- **Auth + signup + onboarding + admin approval loop** (`handle_new_user` 006/007/021; `middleware.ts`; `/admin/approvals` + `approve-account.ts`; certs activate on approval; credentials email).
- **RLS isolation + privilege guards**: member-own policies; `is_admin()` override; `guard_profile_update` (009/011), `guard_message_insert` (014), `guard_reciprocity_write` (017); `certifications` read-only to members (013); cert_schedules admin-only write (016); admin storage upload into member folders (018).
- **CEU**: submit + real computed compliance KPIs + admin approve/reject + status emails.
- **Documents**: upload (storage + signed-URL view) + admin request→fulfil loop (010).
- **Apply (initial)** + **Renew** native forms with attestation/e-signature.
- **Invoices**: admin create + member Stripe pay + webhook mark-paid + auto $150 renewal invoicing (`scheduled-reminders`) + downloadable receipts (member + admin).
- **Stripe plumbing**: checkout/webhook (idempotent on `stripe_event_id`), customer-id persistence, portal route, invoice-checkout — **needs only the price map seeded**.
- **Admin console** (full): dashboard, reports, finance, compliance, approvals, documents, CEUs, applications, requests, members + 360° detail + issue-cert, messaging (two-way), create-invoice, search, audit log, CSV exports.
- **Verification end-to-end** (public form + portal + one-click decision + emails).
- **Two-way messaging**, **account settings**, **reciprocity OUT/INTO**, **cert file upload→download**, **name-change ID upload**.
- **Cert due-dates TS engine** (`src/lib/schedules.ts`) + unit tests — *built and correct, just not yet wired into product surfaces.*
- Contact form + board-member application (Resend with `contact_messages` fallback).

---

## 5. MANUAL OWNER STEPS (current reality)

1. **Apply migrations** `001..018, 021` (Supabase SQL editor or `supabase db push`). No `019`/`020` exist — skipping them is expected. All are additive/idempotent.
2. **Promote first admin** (manual SQL): `update public.profiles set portal_role='admin', account_status='approved' where email='abcac@abcac.org';`
3. **Seed Stripe** (unblocks ALL payments): run `scripts/seed-stripe.ts` with a Stripe key → populates `src/data/stripe-price-map.json` (currently `{}`). Confirm the new `icrc-reciprocity-transfer` $150 product is included.
4. **Seed `cert_schedules` with REAL data**: `016` seeds conservative defaults (CPRS/CPS flagged "confirm against real schedule"). Run `scripts/import-cert-schedules.ts` with the owner's due-dates spreadsheet to load actual per-credential cycles/CEU rules.
5. **Set env vars** (`.env.local` / Vercel): `NEXT_PUBLIC_SITE_URL`, Supabase URL + anon + **service role**, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, **`RESEND_API_KEY` + `RESEND_FROM_EMAIL`** (without Resend, all email silently no-ops), and verify the `abcac.org` sending domain in Resend.
6. **Deploy Edge Functions + pg_cron**: `events`, `scheduled-reminders`, `admin-notify` (+ legacy `create-checkout`/`stripe-webhook`); set Vault secrets (`edge_functions_url`, `service_role_key`) that gate the DB notify triggers; schedule `scheduled-reminders` daily (003 / `AUTOMATIONS.md`).
7. **(Optional) Import n8n `ABCAC-01-RENEWAL-ALERTS`** — but first create the `cert_renewal_candidates` RPC/view it depends on (gap #7), or rely on `scheduled-reminders` instead.
8. **Configure Supabase Auth** redirect URLs + email confirmation for signup/reset.

---

_Generated read-only. No feature code changed; only this document was added. `npm run build` exit 0._
