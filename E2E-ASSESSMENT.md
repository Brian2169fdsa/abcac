# ABCAC Platform — End-to-End Pre-Launch Code Assessment

**Date:** 2026-06-07
**Branch assessed:** `main` (worktree HEAD `348f05a`)
**Scope:** Next.js 14 (App Router) + Supabase (Postgres/RLS, Storage, Edge Functions) + Stripe. DB migrated through `023`. Env vars set in Vercel. Read-only hardening pass; only this doc was added.

---

## 1. Executive Summary

The platform is **architecturally sound and close to launch-ready, but NOT launch-ready as-is.** The build is green (`npm run build`, `tsc --noEmit`, and `vitest` all pass — see §7), RLS is enabled on every table and the migration set (009/013/014/015/017/021/023) is genuinely defense-in-depth: privilege-escalation is blocked with `BEFORE` triggers, the service role is only used behind explicit server-side admin re-checks, and email/CSV output is escaped. Security posture is strong.

However there are **three must-fix blockers** that break primary launch flows, plus a cluster of medium issues that will cause silent data/UX drift in production.

### Top blockers (must fix before launch)

1. **[HIGH] Certificate issuance is broken — `certifications.certificate_url` column does not exist.** The admin "Issue Certification" form inserts a `certificate_url` value into `public.certifications`, but no migration ever adds that column to that table (migration 018's header comment misreads migration 001 — the `certificate_url` at 001:46 belongs to `ceu_records`, not `certifications`). PostgREST rejects inserts that reference an unknown column, so **every credential issuance fails** (with or without a file attached, because the key is always present in the payload). This breaks the central member→admin flow: issue → member sees credential → download. Fix: add `ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS certificate_url TEXT;` in a new migration.

2. **[HIGH] The public site's "Member Portal" CTA points at the legacy static portal (`/portal`), not the live app.** `src/lib/nav.ts` hardcodes `MEMBER_PORTAL.href = "/portal"`, which `site-header.tsx` renders as the primary desktop + mobile member-portal button. `/portal` is the deprecated static HTML app (`public/portal/`, ~4,400 lines) that the GO-LIVE runbook explicitly schedules for retirement and that `TODO.md` (incorrectly) claims "no in-app links point to." Members clicking the headline CTA land in the parallel legacy app rather than the assessed Next.js `/account` portal. Fix: point it to `/account` (or `process.env.NEXT_PUBLIC_PORTAL_URL`, which the runbook says should be `/account`).

3. **[HIGH/operational] The Stripe price map is empty (`src/data/stripe-price-map.json` = `{}`).** With no price IDs, `getPriceId()` returns `undefined` for every slug, so `/api/stripe/checkout` returns `price_not_found` (503) for **all** store purchases, renewals, certification-sync, and the $150 reciprocity-OUT fee. This is by-design a per-environment deploy step (`npm run seed:stripe` writes the map — GO-LIVE §5), but until it is run against the live Stripe account **no online payment works.** This is a required manual launch step, not a code bug — listed here because it gates the entire payments surface.

Everything degrades gracefully around these (reciprocity falls back to "we'll invoice you," cert pages read `*` so they don't crash), so the app stays up — but the happy paths above do not complete until fixed.

---

## 2. Ranked Findings

| # | Sev | Area | Finding | Location |
|---|-----|------|---------|----------|
| 1 | HIGH | Correctness | `certifications.certificate_url` column missing → all cert issuance inserts fail | `issue-cert-form.tsx:83`, `001_initial_schema.sql:24-35`, `018_certificate_file.sql:10` |
| 2 | HIGH | Loose end | Header "Member Portal" CTA routes to legacy static `/portal`, not `/account` | `src/lib/nav.ts:98-101`, `site-header.tsx:42,114` |
| 3 | HIGH | Payments | Empty `stripe-price-map.json` → every checkout returns 503 until `seed:stripe` is run | `src/data/stripe-price-map.json`, `catalog.ts:71`, `checkout/route.ts:37-41` |
| 4 | MED | Correctness | Name-change approval never writes `new_name` back to `profiles.first/last_name` | `decide-request.ts:104-115` |
| 5 | MED | Build/health | `safeList`/`safeOne` swallow all query errors → admin 360 shows "No records" on a real RLS/schema failure | `members/[id]/page.tsx:38-56` |
| 6 | MED | Data integrity | `payments.member_id` for guest/subscription rows is NULL; `invoice.paid` writes `member_id: null` → revenue rows unattributable to a member | `webhook/route.ts:181-193`, `004:11` |
| 7 | LOW | Correctness | Admin 360 CEU KPI hardcodes `/40 /3 /3` instead of per-credential `cert_schedules` (member renewals page uses the schedule) | `members/[id]/page.tsx:258-270` |
| 8 | LOW | Security | Stripe receipt email interpolates `first_name`/`product_name` into HTML **without** `escapeHtml` (other email paths do escape) | `webhook/route.ts:119,124-129` |
| 9 | LOW | Loose end | Dead toggle: notification setting marked "coming soon" is rendered but non-functional (`icrc_updates`) | `notification-settings.tsx:143` |
| 10 | LOW | Loose end | `TODO.md:18` asserts "no in-app links point to the static app" — factually wrong (see #2) | `TODO.md:18` |
| 11 | LOW | Loose end | Legacy static portal (`public/portal/*`, root duplicates) still shipped & served via `next.config.mjs` rewrites | `next.config.mjs:4-10`, `public/portal/` |
| 12 | LOW | Security | No rate limit / CAPTCHA on public `/api/contact` and `/api/verification` (service-role inserts) | `contact/route.ts`, `verification/route.ts` |

---

## 3. Per-Area Detail

### 3.1 Correctness / flow tracing

Each member→admin flow was traced end-to-end. Persistence, mirroring to admin, and reflect-back are noted.

- **Signup → approval.** ✅ Persists. `signUp` carries `first_name/last_name/phone/cert_status/cert_numbers` in `raw_user_meta_data`; `handle_new_user()` (021) creates the profile `account_status='pending'` and copies `submitted_cert_numbers`. Middleware gates unapproved members to `/account/onboarding`. Admin approves at `/admin/approvals` / member 360 → `account_status='approved'`, pending certs flipped `active`, approval + credentials emails sent. Audit logged. RLS prevents self-approval (009 trigger). Solid.
- **Apply → status.** ✅ Persists. `applications` insert via RLS-gated browser client; admin sets status via `AppStatusControl`; member sees status timeline. `force-dynamic` ensures fresh reads.
- **Document upload → review.** ✅ Persists. File → `member-documents/<uid>/...`, row in `documents`. Admin reviews via `ReviewActions` (RLS `admin_all_docs`), member emailed by 005 status trigger. Admin can also *request* a doc (`document_requests`, 010) and the member fulfills it.
- **CEU log → approve → KPI.** ✅ Persists & reflects. CEU insert (member), admin approve via `ReviewActions`. `computeCompliance()` counts only `status='approved'` records; the candidates RPC/view (022) mirrors the same math server-side. **Minor (#7):** the admin 360 KPI denominators are hardcoded 40/3/3 while the member renewals page honors the credential's `cert_schedules` row — the two views can disagree for non-default credentials (e.g. CPRS 20/2/2).
- **Renewal + sync.** ✅ Reads correct. Renewals page computes grace-aware due dates from `cert_schedules` + `expiration_date`. Sync: paying the `certification-sync` slug flips `certifications.sync_enabled=true` in the webhook (service role); members cannot self-enable (013 made certs read-only to members). Correct — but gated on #3 (price map) for the payment leg.
- **Name change.** ⚠️ **(#4)** Persists & is reviewable, but approval does **not** update the canonical name. `decideRequest('name_change_requests','approve')` sets `status='completed'` and emails the member "your records will be updated," yet never writes `new_name` into `profiles.first_name/last_name`. There is no admin profile-name editor wired to this. Net: approving a name change is cosmetic — the member's displayed/certificate name is unchanged.
- **Verification (member + public).** ✅ Both directions persist. Member form inserts to `verification_requests` (RLS own-rows). Public form posts `/api/verification` → service-role insert with `source='public'`, anon has no INSERT policy (correct deny-by-default). Admin one-click `decideVerification` writes `verification_result`/`verified_at`/`status`, audits, and emails the requester (escaped). Solid.
- **Reciprocity OUT / INTO + payment reconcile.** ✅ Well-wired. OUT: row persisted *first* (so admin always sees it), then `/api/stripe/checkout` with `reciprocityRequestId` in metadata; webhook flips `payment_status='paid'`+`stripe_session_id` keyed on that id. Members can't self-mark paid (017 trigger). INTO: no fee, captures origin board. Admin approval of OUT notifies the destination board email. The only caveat is #3 — without a seeded `icrc-reciprocity-transfer` price the flow falls to the "ABCAC will invoice you" branch (graceful, but no card capture).
- **Messaging both directions.** ✅ Persists & mirrors. Member→admin insert is pinned by `guard_message_insert` (014): `member_id=auth.uid()`, `sender_role='member'`, `from_name` can't be "ABCAC Admin", `is_read=false`. Admin→member via `admin_all_messages`. Member panel marks admin messages read on view. Bodies rendered as text (React-escaped) — no XSS.
- **Invoices / receipts.** ✅ Persists. Admin creates `invoices`; member pays via `/api/stripe/invoice-checkout` (re-checks ownership + not-already-paid server-side); webhook marks paid + writes `payment_intent`; receipt email sent. Member data export (`/api/account/export`) and admin CSV exports work and are auth/role-gated.
- **Certificate issue → download.** ❌ **(#1)** Broken — see blocker. Issuance insert fails on the missing column; the member download path (`CertificateActions.downloadFile`) therefore never has a `certificate_url` to sign. The print-to-PDF certificate/wallet card path still works for the no-file case *only if* issuance itself succeeded, which it currently can't because the insert always includes `certificate_url`.

### 3.2 Security / RLS

Overall: **strong.** Re-read middleware + 009/013/014/015/017/021/023.

- **RLS coverage:** Every `public` table created across 001/002/004/010/016 has `ENABLE ROW LEVEL SECURITY` and explicit policies. No table left open. Verified by scanning all migrations.
- **No dangerous `FOR ALL` member policy remains:** 001 shipped several `FOR ALL USING(auth.uid()=member_id)` policies (no `WITH CHECK`). These were systematically tightened: certifications → SELECT-only (013), messages → SELECT+UPDATE+constrained INSERT (009/014), profiles → column-immutability trigger (009), reciprocity → `WITH CHECK` + decision-column guard (017), supervision → `WITH CHECK` + no self-supervision (023). Remaining member `FOR ALL` policies (ceu, docs, employment, other_certs, applications, name_change, prefs, verifications) are appropriately scoped to own rows and their write surfaces are benign.
- **Service-role usage:** `createSupabaseAdminClient()` is used in: Stripe webhook (signature-verified, no auth context needed), `/api/verification` & `/api/contact` (public, input-validated, no privileged reads returned), `/api/stripe/invoice-checkout` (re-checks `invoice.member_id === user.id`), and the admin server actions `decide-request.ts` / `decide-verification.ts` / `approve-account.ts` — **all three re-fetch `portal_role='admin'` on the cookie-bound (RLS) client before touching the service role.** No service-role path trusts a client-supplied role.
- **Member-supplied IDs:** Server actions take `id`/`memberId` from the client but every privileged action is admin-gated first, so an attacker can only act as the admin they already are. The candidates RPC (022) and `find_member_id_by_email` (023) are `SECURITY DEFINER` but each explicitly gates on `is_admin()`/`service_role` or auth presence and returns minimal data.
- **XSS:** All transactional emails escape interpolated values **except** the Stripe receipt email (#8 — `first_name`, `product_name`). `product_name` is catalog-sourced (low risk); `first_name` is user-controlled, so a crafted name could inject markup into the receipt HTML. Add `escapeHtml`. The static portal is a separate concern (#11). Marketing pages render static/escaped content.
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY`/`STRIPE_SECRET_KEY`/`RESEND_API_KEY` are read server-side only; client gets anon + publishable keys only. `.env.example` is clean. Webhook verifies signature and refuses without `STRIPE_WEBHOOK_SECRET`.

### 3.3 Stripe / payments

- **Checkout:** `/api/stripe/checkout` validates slug→product→priceId, attributes to the signed-in member (or guest), reuses `stripe_customer_id`, and forwards reciprocity metadata last so reserved keys can't be clobbered. Good.
- **Webhook idempotency:** ✅ Real. `payments.stripe_event_id` is `UNIQUE` (004:13) and the handler short-circuits on an already-seen event id. Side-effects (invoice paid, reciprocity paid, sync flag) are individually try/caught and the route always 200s so Stripe stops retrying. One nuance: idempotency check + insert isn't transactional, so concurrent duplicate deliveries could both pass the `select` before either inserts — but the `UNIQUE` constraint makes the second `insert` fail harmlessly (logged, not retried). Acceptable.
- **Empty price map (#3):** the gating issue — covered in blockers.
- **Reciprocity reconcile:** ✅ correct (see 3.1).
- **Receipt generation:** ✅ best-effort email on `checkout.session.completed`; never blocks the 200. Minor XSS (#8).
- **Subscription/invoice.paid:** writes `member_id: null` (#6) — recurring renewals land in `payments` unattributed to a member, so per-member payment history and the admin 360 "Payments" table miss subscription renewals. Consider resolving member by `stripe_customer_id` on `invoice.paid`.

### 3.4 Data integrity

- **FKs/cascades:** Member-owned tables FK `profiles(id) ON DELETE CASCADE` — clean teardown. `payments.member_id` is `ON DELETE SET NULL` (keeps revenue history) — reasonable, but combined with #6 yields orphan-ish (member-less) payment rows by design.
- **Uniques:** `profiles.email`, `certifications.cert_number`, `invoices.invoice_number`, `payments.stripe_event_id`, `cert_schedules.credential_type` — all present. Note `cert_number UNIQUE` means re-issuing the same number (e.g. correction) requires clearing the old row first.
- **Status enum desync:** Decisions deliberately map onto a shared vocabulary (`approve→completed`, `deny→rejected`, verification `verified→completed`) so member-side badges and admin queues read consistently. The one true desync is **#4 (name change)**: request shows `completed` while the profile name is stale.
- **Orphan-able rows:** name-change/verification/reciprocity rows persist even if a member abandons mid-flow (intended — admins see abandoned requests). Reciprocity OUT rows persist before payment, with `payment_status='unpaid'`, which is correct.

### 3.5 Build / test / health

- `npm ci` — clean install.
- `npx tsc --noEmit` — **PASS** (exit 0, no errors).
- `npm test` (vitest) — **PASS**: 7 files, 44 tests (schedules, ceu-compliance, catalog, blog, utils). All deterministic; no flaky/`.skip`/`.only` observed. Tests cover pure logic (compliance math, schedule tiers, catalog) but **not** the broken cert-issuance insert or any DB/RLS behavior — which is why #1 slipped through.
- `npm run build` — **PASS** (exit 0). Re-run after adding this doc to confirm the tree still builds (only a doc was added).
- **`force-dynamic`:** applied to all 33 session-dependent portal/admin pages + the webhook — correct (these read per-user data / need raw body). No misuse found.
- **`?? []` / error masking (#5):** the admin 360 `safeList`/`safeOne` helpers `catch`/`return []` on *any* error. This was added so a not-yet-applied migration wouldn't crash the page, but now that the DB is fully migrated it masks genuine RLS/permission/query failures as empty sections — an admin could believe a member has no documents/CEUs when a query actually errored. Recommend logging the error (not silently empty) now that migrations are live.

### 3.6 Loose ends

- **Legacy static portal (#2, #11):** `public/portal/{index.html,admin.html,js/portal.js,js/admin.js}` (~4,400 lines) is a complete *parallel* member+admin app talking directly to Supabase + the `create-checkout` Edge Function. It's served via `next.config.mjs` rewrites and **linked from the main header** (#2). GO-LIVE-UNIFIED §7 + TODO.md schedule it for retirement. Decision needed: retire it (and fix the header link) or keep it — but shipping both with the headline CTA pointing at the legacy one is the current state and is a launch blocker.
- **Dead toggle (#9):** `icrc_updates` notification preference renders a "coming soon" badge and saves, but nothing consumes it.
- **TODO.md drift (#10):** claims no in-app links point to the static app — contradicted by the header.
- **No `TODO`/`FIXME`/`mock`/`stub` remnants** were found in `src/` (only legit placeholder *attributes* on inputs). The codebase is free of stub data and dead feature flags beyond #9.

---

## 4. MANUAL OWNER STEPS REMAINING (for launch)

These are deploy/config steps the code expects an owner to perform (mostly from GO-LIVE-UNIFIED, confirmed against the code):

1. **Run `npm run seed:stripe`** against the **live** Stripe account and commit/deploy the resulting `src/data/stripe-price-map.json`. Without this, no payment works (#3). Verify `icrc-reciprocity-transfer`, `certification-sync`, and the renewal-fee slug all get price IDs.
2. **Stripe webhook endpoint:** add `https://<domain>/api/stripe/webhook` for `checkout.session.completed` + `invoice.paid`; set `STRIPE_WEBHOOK_SECRET` in Vercel. Point Stripe at the **Next.js** route (the Supabase `stripe-webhook` function is legacy).
3. **Promote the first admin:** `update public.profiles set portal_role='admin', account_status='approved' where email='abcac@abcac.org';`
4. **Supabase Auth URL config:** Site URL = prod domain; add `/auth/callback` redirect URLs (prod + preview + localhost) so signup-confirm and password-reset links work.
5. **Confirm storage buckets** `member-documents`, `ceu-certificates`, `name-change-docs` exist and are **private** (created by migration 002).
6. **Deploy Edge Functions** (`admin-notify`, `events`, `scheduled-reminders`, `create-checkout`) and set their secrets + the Vault secrets (`edge_functions_url`, `service_role_key`) used by DB triggers / daily cron.
7. **Set `RESEND_API_KEY` / `RESEND_FROM_EMAIL`** (optional but needed for all member/requester emails — everything no-ops gracefully without it).
8. **Decide on the legacy static portal** and fix the header CTA (#2) accordingly before exposing the marketing site.

---

## 5. Recommended fix order (smallest-diff, highest-impact first)

1. Add `certifications.certificate_url` column (one-line migration) — unblocks cert issuance (#1).
2. Repoint `MEMBER_PORTAL.href` to `/account` (one line in `nav.ts`) — unblocks the portal entry point (#2).
3. Run `seed:stripe` (#3 — config, no code).
4. Apply the approved `new_name` to `profiles` in `decide-request.ts` (#4).
5. Log errors in the admin-360 `safe*` helpers (#5); resolve `member_id` on `invoice.paid` (#6); escape receipt email vars (#8).
6. Backlog: per-schedule KPI in admin 360 (#7), retire static portal (#11), remove/implement the dead toggle (#9), rate-limit public endpoints (#12).
