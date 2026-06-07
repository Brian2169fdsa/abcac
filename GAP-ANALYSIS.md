# GAP-ANALYSIS.md — Member portal surfaces vs build brief

Method: every claim is grounded in the files cited. "Writes" = an `insert`/`update`/storage `upload` against Supabase; "Reads real data" = server component or client query against the live schema; "Mock/stub/dead" = hard-coded, missing wiring, or no-op. The primary portal is the Next.js app at `/account/*` (the static `public/portal/*` is legacy — see Cross-Cutting).

Legend for each surface: **(a) writes** · **(b) reads** · **(c) mock/stub/dead** · **(d) missing vs brief**.

---

## 1. Personal Info / Profile & Settings — `src/app/(portal)/account/profile/page.tsx`, `src/components/profile-form.tsx`
- (a) Writes `profiles` (contact fields) and `notification_preferences` (alert toggles) via `ProfileForm` (browser client, RLS). Password change available.
- (b) Reads `profiles` + `notification_preferences` server-side.
- (c) None material.
- (d) Largely complete. (Profile completeness % is computed on `/account` from first/last/phone/address/city/state/zip.)

## 2. Employment Info — `account/experience/page.tsx`, `AddEmploymentForm` in `src/components/portal-forms.tsx`
- (a) Writes `employment_records` (member_id, employer_name, position_title, start/end, is_current).
- (b) Reads `employment_records`.
- (c) No edit/delete (add-only). No admin review surface for employment.
- (d) Minor: no edit/delete; acceptable for brief.

## 3. Certificate & Wallet Card — `account/certifications/page.tsx`, `src/components/certificate-actions.tsx`
- (a) None (read-only credentials per migration 013).
- (b) Reads `certifications` for the member; renders certificate + wallet card from real cert fields.
- (c) **PDF is "print-to-PDF" via `window.print()` on a generated HTML doc — not a server-rendered/branded PDF file.** Only shown when `status==='active'`.
- (d) Acceptable if print-to-PDF is OK; a true downloadable PDF artifact is not generated.

## 4. Other Certifications — `account/experience/page.tsx` ("Other Certifications"), `AddOtherCertForm`
- (a) Writes `other_certifications` (credential_title, number, issuing_board, issued/expiration).
- (b) Reads `other_certifications`.
- (c) **No file upload + preview.** Brief wants upload+preview of the external credential document; the form is text-only and there is no storage path column on `other_certifications`.
- (d) **MISSING: file upload + preview for Other Certifications.** Would need a storage path column (or reuse `documents`) + preview UI.

## 5. Apply for Certification — `account/apply/page.tsx`, `src/components/member-application-form.tsx` (mode="initial")
- (a) Writes `applications` (app_type='initial', cert_type, attested, attested_at, signature_name, member_notes); uploads supporting files to `member-documents` storage and inserts `documents` rows.
- (b) Reads member first_name for prefill.
- (c) None — this is a **native in-portal flow** (not a redirect). Note: paying the fee is a separate Stripe store purchase (`/initial-certification` / `/store/[slug]`); credential is issued by admin after review (webhook never auto-grants).
- (d) Complete for brief.

## 6. Document Upload — `account/documents/page.tsx`, `src/components/document-upload.tsx`, `view-file-button.tsx`
- (a) Writes storage `member-documents` + `documents` rows. Member can view own files via signed URL.
- (b) Reads `documents`, latest `applications.cert_type` (drives a credential checklist), and open `document_requests`.
- (c) The "checklist" matches doc types by substring — heuristic, not authoritative.
- (d) Complete; admin request→fulfil loop works (see Admin Requests).

## 7. CEU Tracker — `account/ceus/page.tsx`, `src/components/ceu-submit-form.tsx`, `src/lib/ceu-compliance.ts`
- (a) Writes `ceu_records` (status='pending'); optional certificate upload to `ceu-certificates` storage.
- (b) Reads `ceu_records`. **KPIs computed from REAL approved records** (`computeCompliance`): total/40, Ethics/3, Cultural Diversity/3, remaining, compliant flag. Only `status==='approved'` rows count.
- (c) None.
- (d) **Admin approval workflow EXISTS** — `/admin/ceus` + `ReviewActions` set approved/rejected; status-change trigger (005) emails the member. Complete.

## 8. Certification Renewal (+ $15/mo Sync) — `account/renew/page.tsx` (form), `account/renewals/page.tsx` (status), `/account` Sync section
- (a) Renewal form (`MemberApplicationForm` mode="renewal") writes `applications` (app_type='renewal'), uploads CE docs, and inserts a summary `ceu_records` row. Sync subscription is a Stripe checkout (`/store/certification-sync`); webhook sets `certifications.sync_enabled=true` on `slug==='certification-sync'`.
- (b) `renewals` page reads active `certifications` + CEU compliance; computes days-left and 90-day urgency.
- (c) The renewal **fee** ($150) is a separate store purchase — not collected in the form. The `scheduled-reminders` Edge Function auto-creates a $150 unpaid renewal invoice 30 days out.
- (d) Mostly complete. **Sync toggles ALL of a member's certs to `sync_enabled=true` indiscriminately** (`.eq("member_id", memberId)`), with no per-cert selection or date-alignment logic — the "$15/mo sync" is a flag + Stripe sub, not an actual date-reconciliation engine. Manage-subscription routes to Stripe billing portal (works only once `stripe_customer_id` / customer exists).

## 9. Authorizations: Clinical Supervision — `account/experience/page.tsx`, `AddSupervisionForm`
- (a) Writes `supervision_records` (keyed on `supervisor_id`; status active/completed).
- (b) Reads `supervision_records` for the supervisor.
- (c) Add-only; no edit/delete; no admin review surface.
- (d) CRUD is **C+R only** (no U/D). Acceptable if brief only needs record-keeping.

## 10. Name Change Request — `account/requests/page.tsx`, `NameChangeForm` in `portal-forms.tsx`
- (a) Writes `name_change_requests` (current_name, new_name, reason, status='pending'). INSERT trigger (003) alerts admins via `events`.
- (b) Reads request history.
- (c) **ID/supporting-doc upload is NOT wired to this request.** The form tells the member to upload the document on the Documents page; `name_change_requests.doc_path` is never populated by the portal (it stays null), and the dedicated `name-change-docs` storage bucket is unused by any UI. Admin `/admin/requests` shows a "Doc" column with `ViewFileButton bucket="name-change-docs"` — but `doc_path` is always null, so it always renders "—".
- (d) **MISSING: ID upload → `name-change-docs` storage → populate `doc_path` → admin queue preview.** Admin queue + status (Complete/Reject) + email-on-insert exist; the document leg is the gap.

## 11. Verification of Certification — `account/requests/page.tsx`, `VerificationForm`; admin `/admin/requests`
- (a) Writes `verification_requests` (purpose, recipient_name, recipient_email, notes, status='pending'). INSERT trigger alerts admins.
- (b) Reads request history.
- (c) **The form does NOT list the member's certifications.** There is no "Certification to Verify" dropdown populated from `certifications`; `verification_requests.cert_id` exists in schema but the form never sets it. Free-text purpose/recipient only.
- (d) Multiple gaps vs brief:
  - **No dynamic "Certification to Verify" select** listing ALL member certs (cert_id stays null).
  - **No PUBLIC verification-request form on the main site** — confirmed: nothing under `src/app/(site)/**` writes `verification_requests`; verification is portal-only.
  - **Admin action is generic Complete/Reject, not one-click "Verified / Not Verified," and sends NO verification email to the recipient.** `RequestReviewActions` only flips `status`/`completed_at` + audit log; it does not email `recipient_email`. (Insert alert to admin exists; outbound verification letter does not.)

## 11b. Verification — required new work (priority)
A public site form + recipient email + cert selection + one-click Verified/Not-Verified are all MISSING. This is the single largest cluster of brief gaps in "Requests."

## 12. IC&RC Reciprocity — `account/requests/page.tsx`, `ReciprocityForm`; admin `/admin/requests`
- (a) Writes `reciprocity_requests` (direction `out_of_az`|`into_az`, credential, destination, reason, status='pending'). INSERT trigger alerts admins.
- (b) Reads request history; admin reviews + Complete/Reject.
- (c) Both OUT and INTO directions are a single select — no distinct field sets or workflow per direction.
- (d) Brief's "OUT + INTO flows" exist only as a direction flag on one shared form. Functional but not two tailored flows. No outbound email to destination/origin board.

## 13. Messages (member↔admin) — `account/messages/page.tsx`, `src/components/messages-panel.tsx`; admin `/admin/messaging`, `send-message-form.tsx`
- (a) Member can only `update messages.is_read` (mark read). Admin inserts messages (`from_name='ABCAC Admin'`).
- (b) Member reads own `messages`.
- (c) **One-directional.** RLS (009) explicitly blocks member INSERT; there is no compose/reply UI for members and no thread/parent column on `messages`.
- (d) **MISSING: two-way persisted messaging.** Brief wants member↔admin; today it's admin→member announcements only.

## 14. Invoices & Receipts — `account/invoices/page.tsx`, `pay-invoice-button.tsx`, `/api/stripe/invoice-checkout`, webhook
- (a) Reads `invoices`; Pay button opens a Stripe Checkout for the invoice; webhook marks it paid (`status='paid'`, `paid_at`, `stripe_payment_intent`) on `metadata.invoice_id`.
- (b) Real Stripe-driven: invoices created by admin (`create-invoice-form`) or by `scheduled-reminders` (auto $150 renewal). Payment history on `/account` reads `payments`.
- (c) **No downloadable PDF invoice/receipt.** Receipt is an HTML email from the webhook only; invoices/receipts cannot be downloaded as PDF in the portal. The account JSON export (`/api/account/export`) returns JSON, not a receipt PDF.
- (d) **MISSING vs brief: downloadable PDF receipts/invoices.** Also note a **bug**: the webhook receipt email footer reads "ABCAC — American Board of Certification for Animal Chiropractic" (`src/app/api/stripe/webhook/route.ts` ~line 121) — wrong org name (should be Arizona Board for Certification of Addiction Counselors).

## 15. Account Settings & Alerts (opt-in gating) — `profile-form.tsx` ↔ `notification_preferences` ↔ `scheduled-reminders`
- (a) Writes `notification_preferences` (renewal_reminders, ceu_deadline_alerts, abcac_announcements, icrc_updates).
- (b) `scheduled-reminders` Edge Function reads prefs and **respects** `renewal_reminders !== false` and `ceu_deadline_alerts !== false` before emailing.
- (c) `abcac_announcements` and `icrc_updates` toggles are stored but **not consumed anywhere** (no sender reads them).
- (d) Alert opt-in **does gate** renewal + CEU reminders (good). Announcement/IC&RC prefs are dead toggles. Note the whole reminder path depends on the `scheduled-reminders` function + Resend + pg_cron being deployed (manual, see Cross-Cutting).

---

## CROSS-CUTTING

### Sign-up / Auth loop — `middleware.ts`, `src/app/{login,signup,forgot,reset-password}`, `auth/callback`, `account/onboarding`, `onboarding-flow.tsx`
- Works: signup → `handle_new_user` creates profile (`account_status='pending'`) + prefs → middleware forces unapproved users to `/account/onboarding` → onboarding writes profile + self-reported `certifications(status='pending')` and sets `account_submitted_at` → trigger (008) alerts admins → admin `/admin/approvals` Approve activates certs + emails member. Admin area double-gated (middleware + layout). **ALREADY WORKS.**
- Dependency: requires Supabase Auth email confirmation + redirect URLs configured (manual).

### Stripe products / webhook coverage — `src/lib/stripe.ts`, `lib/catalog.ts`, `data/products.json`, `data/stripe-price-map.json`, `api/stripe/*`
- 11 products defined in `products.json` (initial cert, certification-only, renewal $150, certification-sync $15/mo, testing, 3 CEU endorsements, $500/yr provider fee).
- **`src/data/stripe-price-map.json` is EMPTY `{}`** → `getPriceId()` returns undefined → `/api/stripe/checkout` returns `503 price_not_found`. **Checkout is non-functional until `scripts/seed-stripe.ts` is run** against a live/test Stripe account (manual).
- Webhook handles `checkout.session.completed` (writes `payments`, marks invoice paid, persists `stripe_customer_id`, sets `sync_enabled` for the sync product, sends receipt email) and `invoice.paid` (subscription renewals). Idempotent on `stripe_event_id`. **Coverage is solid once seeded.**
- The native `/api/stripe/webhook` is the live one; the Supabase `stripe-webhook` Edge Function is legacy (per GO-LIVE-UNIFIED §5).

### Cert Due-Dates Engine / `cert_schedules` table — **MISSING (as predicted)**
- No `cert_schedules` table in any migration. Renewal scheduling is implicit: `certifications.expiration_date` + read-time 90/60/30-day computation (`/account`, `/account/renewals`, admin dashboard) + the `scheduled-reminders` function. There is no engine that materializes/normalizes due dates, no per-credential cycle alignment for "Sync," and no stored schedule rows.

### n8n `ABCAC-01-RENEWAL-ALERTS` workflow — **MISSING / superseded**
- No n8n workflow JSON in the repo. The build brief (`ABCAC-MEMBER-PORTAL-BUILD.md`) references n8n Cloud + 10 automations, but the implemented stack replaced n8n with **Supabase Edge Functions** (`events`, `scheduled-reminders`, `admin-notify`) + pg_cron + Resend. Renewal alerts are handled by `supabase/functions/scheduled-reminders/index.ts`, not n8n. If the brief strictly requires the n8n workflow, it is external/not built; functionally the equivalent exists in-DB.

### Email provider — **Resend** (`src/lib/email.ts`, `api/contact`, `api/board-application`, both Edge Functions). No-ops gracefully when `RESEND_API_KEY` unset.

---

## ALREADY WORKS — DO NOT REBUILD
- Auth + signup + onboarding + admin approval loop (certs activate on approval).
- Member RLS isolation + admin override + `guard_profile_update` privilege-escalation guard + cert read-only hardening (013).
- CEU submit + compliance KPIs (real, computed) + admin approve/reject + status emails.
- Document upload (storage + signed-URL view) + admin approve/reject + admin "request a document" → member fulfil loop.
- Apply (initial) + Renew (recertification) native forms with attestation/e-signature.
- Invoices: admin create + member pay via Stripe + webhook mark-paid + auto renewal invoicing (scheduled-reminders).
- Stripe checkout/webhook plumbing (idempotent, customer-id persistence, sync flag) — needs only the price map seeded.
- Admin console: dashboard counts/revenue, approvals, documents, CEUs, applications, requests, members + issue-cert, messaging, create-invoice, search, audit log, reports/finance/compliance, CSV exports (members/expiring/payments).
- Certificate + wallet card generation (print-to-PDF).
- Account data export (JSON).
- Admin-→member messaging + announcements.
- Contact form + board-member application (Resend with contact_messages fallback).

---

## RANKED REAL GAPS (highest priority first)
1. **Stripe price map empty (`stripe-price-map.json = {}`)** — all checkout/payment flows 503 until `seed-stripe.ts` is run. Blocks revenue; highest operational priority (manual owner step, but nothing works without it).
2. **Verification of Certification cluster** — no public-site request form; no dynamic "Certification to Verify" select (cert_id never set); no one-click Verified/Not-Verified; no email to recipient. Largest feature gap vs brief.
3. **Member↔admin two-way Messages** — currently admin→member only (RLS + UI + schema all one-directional). Needs member compose/reply + thread model.
4. **Name Change ID upload** — request never captures the ID document (`doc_path` always null; `name-change-docs` bucket unused); admin preview is dead. Wire upload→storage→doc_path.
5. **Other Certifications file upload + preview** — text-only today; brief wants upload+preview. Needs storage path + UI.
6. **Downloadable PDF invoices/receipts** — only HTML email + JSON export today.
7. **Certification Sync is a flag, not a date-alignment engine; no `cert_schedules`** — Sync sets `sync_enabled` on all certs with no cycle reconciliation; no due-dates engine table.
8. **IC&RC reciprocity OUT vs INTO** are one shared form with a direction flag (no tailored flows, no outbound board email).
9. **Dead alert toggles** — `abcac_announcements` / `icrc_updates` stored but no sender consumes them.
10. **Webhook receipt email wrong org name** ("Animal Chiropractic") — small but customer-facing bug.
11. **n8n ABCAC-01-RENEWAL-ALERTS** not in repo (functionally replaced by `scheduled-reminders`; only a gap if the n8n artifact itself is required).
12. **Clinical Supervision / Employment are add-only** (no edit/delete) — minor.
