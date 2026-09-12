# ABCAC Member Portal — Code Assessment

> Prepared by PHX Creative Works, 2026-09-11. Scope: the credential-holder (member) portal at
> `/account/*`, its authentication entry points, the payment and form pipelines it depends on, and
> the database policies that protect member data. The staff/admin console is out of scope except
> where a member flow depends on it.
>
> Basis: repository `Brian2169fdsa/abcac` at commit `8870405` (main and the working branch are
> identical). Every finding below was verified by reading the code, and the highest-severity items
> were re-verified by hand. Typecheck, lint, the 1,013-test suite, and a production build all pass.

> **Status update, 2026-09-12 (quick-win pass, same branch):** C1, H1, H3 (minimum), H5, H6, M1, M4 (type
> mismatch), M9, M10, M12, M15, M16 are fixed in code, plus the stale `/account/renew` link, the nested
> `<html>` in the not-found page, the `CADC` directory filter, staff "Review …" tasks no longer showing on
> the member dashboard, and `.env.example` now lists `CRON_SECRET` and `ANTHROPIC_API_KEY`. Two new
> migrations (046 guard triggers, 047 retire pg_cron reminders) must be applied to the live database.
> Still open from Track A: H2 (owner: live Stripe seed), H4 (forms workspace after payment), M3
> (approval posture decision), M5 (CCS/CPRS hours, needs ABCAC), M13 (transcript export gate).

---

## 1. Bottom line

The member portal is substantially built. Twenty-three portal routes, the digital application
pipeline for all fifteen ABCAC forms, portal-only Stripe checkout, PDF certificate and wallet-card
generation, two-way messaging, notifications, CEU tracking, exam registration, and the three
request flows all exist and run on real data. The auth layer is sound. The public site hands every
transaction into the portal correctly.

It is not ready to take real members and real money as-is. The repo's own launch document says
"no outstanding code work." That is not accurate. This review found **one critical payment-integrity
defect, six high-severity defects, and roughly seventeen medium items**, several of which directly
affect the 283 legacy members who have already been provisioned. None are large; together they are
about **five to seven developer-days** of focused work, followed by the owner configuration that has
been outstanding since July.

Recommendation: fix the critical and high items (Section 5, Track A), complete the owner
configuration (Track B), run the smoke test, and launch the minimum set in Section 6. Defer the rest
to a post-launch sprint.

---

## 2. Who ABCAC is and what the portal has to do

The Arizona Board for Certification of Addiction Counselors is an IC&RC member board. It certifies
CAC, CADAC, AADC, CPRS, CPS, CCS, and CCJP credentials; administers IC&RC exams (in person and
Prometric remote-proctored) for its own candidates and for AZBBHE licensure applicants; processes
reciprocity transfers in and out of Arizona; endorses CEU workshops and collects an annual fee from
approved CEU providers; and offers a paid "Certification Sync" to align staggered renewal dates.

The fee schedule the portal must support (from `src/data/products.json`, which matches the
scraped abcac.org copy in `abcac_build/reference`):

| Service | Fee |
|---|---|
| Initial certification, application + in-person exam | $375 |
| Initial certification, application + remote exam | $425 |
| Certification only (already passed IC&RC exam) | $150 |
| Two-year renewal | $150 |
| Certification Sync | $15 per month moved |
| Printed certificate copy | $25 |
| IC&RC reciprocity transfer | $150 |
| Exam only, in person / remote | $225 / $275 |
| CEU workshop endorsement (three tiers) | $250 / $375 / $500 |
| CEU provider annual fee | $500 per year (subscription) |

For a member, the portal's job is: hold my credential and let me download it; let me apply or
renew and pay; track my CEUs against my renewal; let me register for an exam; let me upload
documents, ask for a name change or verification, message the board, and see where everything
stands. Every one of those journeys exists in code. The defects are in the seams between them.

Note: abcac.org itself was not reachable from this review environment (network policy). Org
context came from the repo's verbatim scrape of the live Duda site and a web search. Fee and
requirement facts should be confirmed with ABCAC where flagged below.

---

## 3. What is there — route inventory

Grades: **Done** = complete and working; **Gaps** = a member can complete it but with defects or
missing states; **Redirect** = intentionally retired.

| Route | Purpose | Grade | Main issue |
|---|---|---|---|
| `/account` | Dashboard: KPIs, next steps, tasks, action items, credentials, payments | Done | Long page with two overlapping activity feeds; cosmetic |
| `/account/profile` | Personal info + password | Gaps | Approved members' name edits are silently discarded (H6) |
| `/account/settings` | Directory opt-out, notification preferences | Done | — |
| `/account/experience` | Employment + clinical supervision | Gaps | No delete/edit for supervision; label "Authorizations" never shows authorizations |
| `/account/certifications` | Certificate PDF, wallet card, original scan | Done | "Order IC&RC International Certificate" goes nowhere (M16) |
| `/account/certification` | Hub: pick initial vs recert, pick credential | Done | Hardcoded "40 CE hours" copy wrong for CCS/CPRS (M5) |
| `/account/forms?workflow=…` | Digital application workspace, 15 workflows | Gaps | Hides the application once paid; duplicates possible (H4) |
| `/account/applications` | Application status + fee status | Gaps | No link to continue a draft or view a packet (H4) |
| `/account/apply`, `/account/renew` | Legacy entries | Redirect | One stale link remains in `member-plan.ts` |
| `/account/renewals` | Renewal readiness per credential | Done | Uses soonest-expiring credential's schedule only |
| `/account/ceus` | CEU log + compliance | Gaps | Members can self-approve at DB layer (H1); reasons hidden; misleading for applicants |
| `/account/documents` | Upload + admin-requested documents | Gaps | Same missing guard as CEUs (H1); no delete |
| `/account/testing`, `/testing/checkout` | Exam pre-registration + pay | Gaps | Accommodation form not linked to the request; prices hardcoded |
| `/account/certification-sync` | Sync request + pay | Gaps | A flag, not a sync: no date logic, member hand-types credentials (M7) |
| `/account/requests` | Name change, verification, reciprocity | Gaps | Outcome and notes not shown; verification has no letter (M8) |
| `/account/payments` | Catalog pay page, application-fee gate | Gaps | Client metadata reaches webhook authority branches (C1) |
| `/account/invoices` | Admin invoices + payment history + receipts | Gaps | Void invoices payable and counted as due (M10) |
| `/account/messages` | Two-way thread with staff | Done | Badge counts member's own messages (M9); refresh-only |
| `/account/notifications`, bell | In-app notifications | Done | Nothing fires on document/CEU/request decisions (M8) |
| `/account/activity` | Unified history | Done | — |
| `/account/onboarding` | Pending-account profile + cert numbers | Gaps | Only reachable when approval flag is on (M3) |
| `/sign/application/[token]` | Outside signer, no account needed | Gaps | Bare 404 on expiry; no revoke/resend; signer sees whole form |
| `/login`, `/signup`, `/forgot`, `/reset-password`, `/auth/callback`, `/portal`, middleware | Auth | Gaps | Callback ignores exchange errors; cross-device reset dead-ends (M1) |
| Member AI chat widget | Assistant with 8 read + 6 write tools | Done | Off until `ANTHROPIC_API_KEY`; footer claims read-only, it is not |
| `/api/account/export` | JSON data export | Gaps | Omits nine member tables; includes internal fields |

---

## 4. What is genuinely done and working

- **Authentication and session.** `src/middleware.ts` is the single `getUser()` call; it strips any
  client-supplied `x-user-id`, redirects anonymous visitors off `/account/*` and `/admin/*`, persists
  refreshed cookies, and forwards the validated id. Open-redirect protection is consistent. Logout is
  POST-only.
- **Row-level security** is enabled on all 30 tables. Column-pinning guard triggers protect
  profiles, applications, name-change, verification, reciprocity, supervision, and messages. Storage
  buckets are private and scoped to the member's own folder. Service-role writes are confined to
  server code and always filtered by the validated member id.
- **Digital applications.** All 15 ABCAC PDFs are present with correct page counts; every one has a
  native HTML schema covering every fillable page; draft save/resume, required-field gating,
  per-form confirmation, locked submission, staff task creation, paper-upload alternative, and the
  outside-signer flow (hashed 256-bit tokens, 30-day expiry) all work.
- **Application fee linkage** end to end: deep link → checkout metadata → `payment_submissions` →
  webhook advances to `under_review` → in-app notification. The July P0 items are closed.
- **Portal-only checkout.** Nothing is purchasable anonymously. Ownership, type, and status are
  validated for testing, reciprocity, sync, and application payments. Idempotent `payments` insert
  on `stripe_event_id`. Webhook signature verified. Test/live price maps never cross.
- **Certificate and wallet-card PDFs** generate client-side with pdf-lib for active credentials,
  plus admin-uploaded scans via signed URL.
- **Exam pre-registration**: combined exam + certification-only line items, staff task, ClickUp
  push, notifications, admin decision flows back to the member as status, message, and email.
- **Records and communication**: documents with admin-request fulfilment, employment and supervision
  with supervisee linking, all three request types persisted with correct guards, two-way messages,
  notification triggers, activity feed, directory opt-out feeding the public `/verify` and
  `/directory`.
- **Reminder engine** (Vercel cron) is deduplicated via `reminder_log`, delivers in-portal without
  email configured, and fails closed without `CRON_SECRET`.
- **Engineering hygiene**: typecheck clean, lint clean, 82 test files / 1,013 tests green,
  production build green, CI enforces all four on every PR.

---

## 5. What is broken — defects ranked

File references are `path:line` at commit `8870405`.

### Critical

**C1. A member can mark payments as paid that they did not make, or mark another member's invoice paid.**
`src/app/api/stripe/checkout/route.ts:207-210` copies every key of the client-supplied `metadata`
object into the Stripe session metadata. The server only overrides the authority keys
(`payment_type`, `*_id`) when a workflow branch applies (`:211-227`). For a plain product such as
the $25 printed certificate, a member can send `{"invoice_id": "<any uuid>"}` and the webhook at
`src/app/api/stripe/webhook/route.ts:119-125` marks that invoice paid with **no member filter**.
`{"payment_type":"reciprocity","reciprocity_request_id":…}` does the same to any reciprocity
request (`:72-77`). Testing and application branches are member-scoped, but a member can still
have their own $425 exam registration or application marked paid for $25. **Fix:** whitelist the
forwarded metadata keys (or set the authority keys unconditionally after the spread) and add
`member_id` filters to the invoice and reciprocity updates. Half a day including tests.

### High

**H1. Members can self-approve CEU records and documents at the database layer.**
`supabase/migrations/001_initial_schema.sql:235-236` grants `FOR ALL` on `ceu_records` and
`documents` and no later migration adds a guard trigger (the pattern used in 029 for the request
tables). A member's own JWT can `PATCH /rest/v1/ceu_records?id=eq.<own> {"status":"approved"}`.
Approved hours drive the dashboard KPI, renewal readiness, and the reminder engine. This
contradicts `docs/RED_TEAM_ASSESSMENT.md`, which reports RLS as fully verified. **Fix:** migration
046 adding `guard_ceu_write` / `guard_document_write` that pin `status`, `admin_notes`,
`reviewed_at`, and `member_id` for non-admin callers. One to two hours plus live apply.

**H2. Live Stripe cannot take a single payment.** `src/data/stripe-price-map.live.json` is `{}`.
With a live key every checkout returns `503 price_not_found` by design (no fallback to test IDs).
`SETUP-RUNBOOK.md:72,77` also names the wrong file. Owner action (`npm run seed:stripe` with the live
key) plus a one-line doc fix.

**H3. The webhook cannot lose a payment safely.** `webhook/route.ts:48-51` swallows every side-effect
error and returns 200, so a Supabase outage during delivery leaves the payment permanently
unrecorded with no Stripe retry. Side effects run before the idempotency-bearing insert, so a
duplicate delivery double-sends emails and tasks. `session.payment_status` is never checked
(delayed payment methods would be marked paid while unpaid). `checkout.session.expired`,
`async_payment_*`, `charge.refunded`, `invoice.payment_failed`, and `customer.subscription.deleted`
are unhandled, so `payment_submissions` rows sit at `checkout_created` forever and refunds are
invisible. **Fix:** insert `payments` first, return 5xx on DB failure, check `payment_status`,
handle expiry at minimum. One and a half to two days for the full set; one day for the minimum.

**H4. A member loses sight of their application the moment they pay.**
`src/app/(portal)/account/forms/page.tsx:64` loads only `draft` or `submitted` applications. After
the webhook sets `under_review`, or staff set `approved`/`rejected`, returning to the same workflow
shows a blank new application and the member can file a duplicate. There is no read-only view of a
submitted packet, and `/account/applications` cards have no "continue draft" or "view packet" link.
Drafts also display "Submitted <date>" because `submitted_at` defaults to now. **Fix:** load the
latest application regardless of status, render read-only once submitted, add links both ways,
leave `submitted_at` null on drafts. One day.

**H5. Two reminder engines are both scheduled for 14:00 UTC daily.** The pg_cron job in
`supabase/migrations/003_automations.sql:66-77` calls the `scheduled-reminders` edge function (no
dedupe log, also auto-creates a $150 invoice at 30 days); `vercel.json:7` runs
`/api/cron/reminders` (deduped, in-portal + email). Both are dormant today only because email and
Vault secrets are unset. The moment Resend goes live, members get two of every reminder. **Fix:**
keep the Vercel runner, unschedule the pg_cron job, do not deploy `scheduled-reminders`. One to two
hours plus a decision.

**H6. Approved members' name edits are silently discarded.** `src/components/profile-form.tsx:50-55`
sends name fields for every member; migration 036 pins them once `account_status='approved'`.
PostgREST returns success, the UI says "Personal information saved," nothing changed. All 283
provisioned legacy members are approved, so a roster typo is unfixable from the profile page with no
explanation. The assistant's `update_my_profile` tool has the same issue, and the admin
name-change approval drops `middle_name`. **Fix:** read-only name fields with a link to the
name-change request when approved. One hour.

### Medium

**M1. Password reset dead-ends across devices.** `src/app/auth/callback/route.ts:14-15` never
inspects the `error` from `exchangeCodeForSession` (it does not throw, so the `catch` is dead
code). An expired link, a reused code, or opening the email on a different device than the one that
requested it all redirect to `/reset-password`, which shows "invalid or expired" with no guidance.
This is the exact path the legacy members take via "Forgot password." Fix: check the error, redirect
with a message, add a `token_hash`/`verifyOtp` branch. Two to three hours.

**M2. The invite script's invite mode will not work.** `scripts/invite-legacy-members.ts:95-98`
uses `inviteUserByEmail`, whose links carry no PKCE code; the callback reads only `code`. The
create-only path that was actually run is fine. The "portal is ready" campaign must use create-only
plus password reset, and the runbook should say so.

**M3. With the approval flag off (the shipped default), every new signup is permanently pending.**
The signup trigger sets `account_status='pending'` (migration 021); nothing routes to onboarding
unless `PORTAL_ACCOUNT_APPROVAL_REQUIRED=true`; pending members are excluded from admin broadcasts
and shown as pending to the assistant while using the whole portal. Decide: flag on for a controlled
pilot, or default new accounts to approved for open self-service.

**M4. Certificate issuance is disconnected from approval.** Approving an application does not create
a certification; staff must separately use the issue-certificate form and nothing links the two.
The automation's `ISSUANCE_APP_TYPES` (`src/lib/automation/workflows/certificate-issuance.ts:25`)
lists `initial_certification` but the forms write `app_type: "initial"`, so the sweep never sees
initial packets. Two hours for the mismatch; half to one day for a one-click issue link.

**M5. Recertification copy and the CEU engine assert 40 hours for every credential.** The official
`recert-ccs.pdf` and `recert-cprs.pdf` in `public/forms/library` require **six (6) clock hours**
(3 Ethics + 3 Cultural Diversity). `native-form-schemas.ts:40`, `certification-hub.tsx:67-68`, and
the `cert_schedules` seed (041) all say 40. Needs ABCAC confirmation, then half a day to make the
copy data-driven and fix the seed. (The CPRS PDF's own wording says "specific to clinical
supervision," which looks like a copy error in the source form. Worth raising with the board.)

**M6. Fee text in the PDFs disagrees with the catalog.** The counselor supplement says
certification-only is $200 (catalog $150); the CPRS manual lists test $150, manual $50,
recertification $100 (catalog charges CPRS the same $375/$425/$150 set as CAC). Business decision.

**M7. Certification Sync is a flag, not a sync.** The member hand-types credential type, number, and
expiry into a JSON blob; the "calculator" is months × $15; payment moves the application to
`under_review`; nothing in the codebase ever moves an expiration date. Comments claiming the webhook
flips `sync_enabled` are stale. Either accept it as a paid manual request and word it that way, or
build the real thing (compute months from the member's `certifications`, admin approval applies
dates): two to three days.

**M8. Members do not see decisions.** No in-app notification fires when a document, CEU, or
application status changes or a request is decided (the 034 triggers cover invoices, document
requests, tasks, and messages only). The CEU page never fetches `admin_notes`; the requests page
never shows `admin_notes` or `verification_result`. Verification requests produce no letter and the
outcome email goes to the third-party recipient, never the member. One to two days.

**M9. The Messages badge counts the member's own outbound messages.** `(portal)/layout.tsx:32-36`
and `account/page.tsx:128` count `is_read=false` without excluding `sender_role='member'`. After
sending, the member sees "1 unread message" until staff open it. Quarter day.

**M10. Void invoices are payable and counted as amount due.** `invoice-checkout/route.ts:32` only
blocks `paid`; `invoices/page.tsx:43` sums void rows. The `unpaid` default status has no chip tone.
The `?paid=1` return flag is never read. Half a day.

**M11. The annual CEU-provider subscription cannot be managed by the member.** `/api/stripe/portal`
exists but no UI links to it, and `stripe_customer_id` is only set when Stripe creates a Customer,
which one-time checkout does not do by default. Half a day.

**M12. Latent header-trust gap.** `x-user-id` is stripped only on `/account` and `/admin`. Any future
`requireUserId()` consumer outside the matcher would trust a client-controlled header, and six
portal files pair that id with the service-role client. Widen the strip to all routes. Under two
hours.

**M13. `/api/assistant/export-transcript` is an unauthenticated email relay** to any address from
`noreply@abcac.org`, protected only by a per-instance in-memory rate limiter. Gate it behind a
session or disable it for launch. Three to four hours with a durable limiter.

**M14. `/api/board-application` accepts unbounded base64 attachments** from the public and relays
them into the office mailbox. One hour.

**M15. Edge-function emails link to `https://portal.abcac.org`**, a host that does not exist
(`scheduled-reminders/index.ts:19`, `events/index.ts:21`, `admin-notify/index.ts:73`); admin alerts
select `portal_role='admin'` only and exclude superadmins. Thirty minutes.

**M16. "Order IC&RC International Certificate"** (`certifications/page.tsx:205-207`) links to the
generic payments page; no such product exists. Add the product or remove the button.

**M17. The testing accommodations digital form creates a separate application** with no key back
to the testing request; staff correlate by hand.

### Low (cosmetic or hardening)

Orphaned `/checkout/cancel` page with "Return to store" copy; `payments.application_id` never
populated and the fee-paid fallback uses substring matching; fee labels hand-typed in seven places
despite a "catalog is the source of truth" rule; invoice numbers from `Date.now()`; receipt is a
print-to-PDF popup with the raw Stripe session id as the receipt number; CEU page tells applicants
with no credential they need 40 hours; chat widget footer says "your data only" while exposing six
write tools and its `start_reciprocity` never starts checkout; export includes
`account_review_notes` and `stripe_customer_id`; `mock/agent-data.ts` still bundled via a default
parameter; directory filter offers "CADC" which is not an ABCAC credential; upload validation by
extension only, no server-side size/MIME limit, no member delete; signer expiry shows a bare 404,
applicant's own signature lines can be assigned to outside signers, nobody is notified when a signer
signs; `not-found.tsx` nests `<html>` inside the root layout; `.env.example` omits `CRON_SECRET` and
`ANTHROPIC_API_KEY`; staff "Review …" tasks are inserted `visible_to_member: true`; the legacy
static portal files in `public/portal/` are still publicly served at `/portal/index.html` and
`/portal/admin.html`; rate limiters are in-memory per serverless instance; no tests for middleware,
`current-user.ts`, the auth callback, server actions in forms/testing/sync, or any RLS policy.

---

## 6. Minimum set to launch as soon as possible

### Track A — code (about 5 to 7 developer-days, one engineer)

| # | Fix | Effort |
|---|---|---|
| 1 | C1: whitelist forwarded metadata, member-scope invoice + reciprocity webhook updates, tests | 0.5 d |
| 2 | H1: migration 046 guard triggers for `ceu_records` + `documents`, apply live | 0.25 d |
| 3 | H3 minimum: check `payment_status`, insert `payments` first, 5xx on DB failure, handle `checkout.session.expired` | 1 d |
| 4 | H4: load latest application any status, read-only submitted view, continue/view links, null `submitted_at` on drafts | 1 d |
| 5 | H5: unschedule pg_cron reminders; document single path | 0.25 d |
| 6 | H6: lock name fields when approved, link to name-change request; fix `middle_name` in approval | 0.25 d |
| 7 | M1: callback error handling + friendly reset/login error states | 0.5 d |
| 8 | M9 badge, M10 void invoices, M15 edge URLs + superadmin, M16 dead CTA, M12 header strip, env example | 0.75 d |
| 9 | M3: decide approval posture and implement (flag on, or default approved) | 0.25 d |
| 10 | M5: confirm CCS/CPRS hours with ABCAC; update copy + seed | 0.25 d |
| 11 | M13: disable or gate `export-transcript` for launch | 0.25 d |
| 12 | Regression: unit tests for the above, full smoke test on production in test mode | 1 d |

### Track B — owner configuration (unchanged since July, still open)

1. Stripe webhook endpoint registered, `STRIPE_WEBHOOK_SECRET` set, verified with a test purchase.
2. Resend account, `abcac.org` domain verified, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set.
3. `CRON_SECRET` set in Vercel.
4. Live Stripe: `npm run seed:stripe` with the live key, commit `stripe-price-map.live.json`, swap keys, add live webhook.
5. Supabase Auth redirect allow-list includes the production `/auth/callback`.
6. `NEXT_PUBLIC_SITE_URL=https://abcac.org`; DNS cutover.
7. Decide reminder path (Track A #5) and approval posture (Track A #9).
8. Optional at launch: `ANTHROPIC_API_KEY`, ClickUp, AZBBHE logo.

### Launch scope

**Ship:** dashboard, profile and settings, certificate and wallet card download, initial and
recertification applications with pay-at-the-end, payments and invoices, documents, CEU tracker,
exam registration, name change / verification / reciprocity requests, messages, notifications,
activity, public verify and directory.

**Ship with honest wording or hide:** Certification Sync (present it as a paid request that staff
apply manually until M7 is built); the CEU-provider annual subscription (no self-service management
yet); the AI assistant (stays off until the key is set, which is fine).

**Remove for launch:** the IC&RC International Certificate button; the public
`export-transcript` route; the legacy static files in `public/portal/`.

**Legacy member campaign:** create-only accounts plus "Forgot password," never invite mode, and only
after M1 is fixed. Start with 25 to 50 per day as the runbook already says.

---

## 7. What it takes to finish the whole thing (post-launch)

| Area | Work | Effort |
|---|---|---|
| Payments | Full webhook event coverage (refunds, failures, subscription lifecycle), `payments.application_id` populated, catalog-driven fee labels, sequence-based invoice numbers, server-side receipt with Stripe reference, Customer Portal link + `customer_creation` | 3–4 d |
| Applications | Certificate issuance linked to approval (one-click), signer flow polish (friendly expiry, revoke/resend, notify applicant, signer-only sections), certificate PDF seal + verification QR, collapse three entry points into one | 3–4 d |
| Records & requests | Notification triggers for document/CEU/application/request decisions, show admin notes, verification letter PDF emailed to the member, CEU edit/delete + applicant state, document delete + server-side limits | 3–4 d |
| Certification Sync | Real date logic from the member's credentials, admin approval applies dates, link accommodations form to testing request | 2–3 d |
| Auth & platform | Tests for middleware / current-user / callback, durable rate limiting (Upstash or Vercel KV), export completeness, cleanup of low items | 2–3 d |
| Business reconciliation | Fee schedule vs PDFs, CCS/CPRS hours, CPRS form wording | ABCAC decision |

Total: roughly **13 to 18 developer-days** after launch, in addition to Track A.

---

## 8. Method and limits

- Four parallel code reviews (applications/forms, payments/testing, profile/records/communication,
  auth/database/infrastructure), each producing file-referenced findings; every critical and high
  item, and the most consequential mediums, re-verified by hand against the source.
- Ran `tsc --noEmit`, `next lint`, `vitest run` (82 files, 1,013 tests), and `next build` in a clean
  install. All green.
- Checked every PDF referenced by the form library exists (15/15) and extracted text from the
  recertification PDFs to verify the CEU-hour requirement.
- Not done: live production probing (abcac.org and the Vercel deployment were not reachable from
  this environment), database-level RLS tests against a live Supabase project, and browser
  walkthroughs. The July documents record that the Stripe webhook was not delivering in production
  and DNS had not been cut over; nothing in the repo since then indicates those changed.
- Existing repo documents that this assessment corrects: `docs/LAUNCH-ASSESSMENT.md` ("no
  outstanding code work") and `docs/RED_TEAM_ASSESSMENT.md` ("RLS coverage: no gaps").
