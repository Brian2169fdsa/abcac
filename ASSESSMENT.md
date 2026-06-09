# ABCAC Platform — Pre-Launch Assessment (2026-06-09)

Consolidated gap report from a 6-agent read-only audit: member↔admin parity, end-to-end
data flows, security/access-control, functional bug hunt, UI/UX completeness, and the
public site / onboarding. No new features — this is the "make sure it all works" punch-list.

**Headline:** the platform is in strong shape. Core member↔admin flows are genuinely
bidirectional, security posture is solid (RLS on every table, gated server actions,
signature-verified webhooks, no privilege escalation), and the public site is fully wired.
The gaps cluster into three buckets: **(A) one real blocking bug + config**, **(B)
control-parity gaps** (things a member can self-enter that admin can only view), and
**(C) polish/defense-in-depth**.

---

## A. Launch blockers — "make it work" (fix before go-live)

| # | Sev | Issue | Location | Action |
|---|-----|-------|----------|--------|
| A1 | **Critical (bug)** | **Name-change approval crashes.** `decideRequest` writes `reviewed_by` + `decided_at`, which exist only on `reciprocity_requests`, not `name_change_requests`. The update errors → request never leaves `pending`, and the profile name never updates. (A test even asserts the buggy payload → false confidence.) | `src/app/(admin)/admin/requests/decide-request.ts:60-64`; schema `001` vs `017` | Only set those two columns for `reciprocity_requests`; fix `tests/action-requests.test.ts`. **Code fix.** |
| A2 | **Critical (config)** | **Stripe price map is empty `{}` → every checkout fails** with `price_not_found` (503). No product can be purchased; the sync subscription pushed site-wide is dead. | `src/data/stripe-price-map.json`; `lib/catalog.ts:71`; `api/stripe/checkout/route.ts:37` | Run `npm run seed:stripe` against live Stripe + set Stripe env keys (per `SETUP-RUNBOOK.md`). **Owner config.** |
| A3 | **High (verify)** | **Two divergent Stripe webhooks.** The Next route (`/api/stripe/webhook`) writes `payments` + reciprocity + receipts; the Supabase Edge `stripe-webhook` is invoice-only (no `payments` row). If the Edge one is the registered endpoint, checkout→portal→finance silently breaks. | `src/app/api/stripe/webhook/route.ts` vs `supabase/functions/stripe-webhook/index.ts` | Confirm `/api/stripe/webhook` is the endpoint registered in Stripe; retire/align the Edge function. **Owner verify.** |

---

## B. Control-parity gaps — "if it's on the member side, admin must see + control it"

View-parity is strong; the systemic theme is that anything a member can **self-enter** is
**read-only on admin**. (These are feature additions — candidates for the "expand" phase, not
the wrap-up, except B1/B2 which the owner's rule makes higher priority.)

| # | Sev | Member can | Admin currently | Location |
|---|-----|------------|-----------------|----------|
| B1 | **High** | Edit 4 notification toggles | **Cannot see or override them at all** (zero admin refs to `notification_preferences`) — yet reminders are driven by them, so "Run reminders now" silently no-ops for opted-out members | `account/settings/page.tsx:20`; admin: none |
| B2 | **High** | Edit name/phone/DOB/SSN4/address | **View only** — no admin write path to profile contact fields (the #1 support task) | member-detail `:341-358`; `member-manage.tsx:24` only writes status/role |
| B3 | High | Add/edit employment; add other-certs | **View only** | member-detail `:360-372`, `:395-408` |
| B4 | High | Add supervision they provide | **View only**; and **no UI anywhere to link a supervisee**, so the "supervision received" view can never populate (breaks CCS workflow) | member-detail `:526-573`; `experience/page.tsx:100` |
| B5 | Medium | (has active cert) | Admin can **issue** but not **revoke/expire/edit/toggle sync** an existing cert | member-detail `:375-388` |
| B6 | Medium | Pay invoice | Admin can **create** but not **void/edit/mark-paid** an invoice | member-detail `:661-673` |
| B7 | Medium | Reads app `admin_notes`/ETA | Admin sets only `status`, not the notes/ETA the member reads | `app-status-control.tsx` |
| B8 | Low | — | No admin **document delete**; no admin **per-member data export** mirroring the member's | member-detail `:457` |

---

## C. Integration, security, and polish

### Data-flow / integration
| # | Sev | Issue | Location |
|---|-----|-------|----------|
| C1 | **High** | **Contact-form submissions never reach the console.** When `RESEND_API_KEY` is set the route emails and returns before any DB write; `contact_messages` is only written on the no-email fallback and **no admin page reads it**. Build an admin Inbox over `contact_messages` and always persist. | `api/contact/route.ts:50-81`; no admin consumer |
| C2 | Medium | Verification *result* (verified/not-verified) is written but **not surfaced in the member portal** (member sees only status). | `decide-verification.ts:40` → `account/requests/page.tsx:50` |
| C3 | Medium | Board-application is email-only; attachments dropped on the `contact_messages` fallback; no admin UI. | `api/board-application/route.ts:84-117` |

### Security (no hard escalation found; workflow-integrity + defense-in-depth)
| # | Sev | Issue | Location |
|---|-----|-------|----------|
| S1 | **Medium** | Members can UPDATE decision/status columns on their **own** rows in `applications`, `name_change_requests`, `verification_requests` (no guard trigger — unlike `reciprocity_requests`/`supervision_records` which have one). Could self-set `status='approved'` / `verification_result='verified'` on their own row (corrupts queues / self-attestation; the real side-effects stay admin-gated). | migration `001:240`; pattern to copy: `017`, `023` |
| S2 | Medium | Member `messages` UPDATE policy has no column restriction → a member can rewrite `body`/`subject`/`from_name` of admin messages in their own inbox (meant only to mark read). | `009_rls_hardening.sql:48` |
| S3 | Low | `admin-notify` Edge function uses exact `=== 'admin'` → **excludes superadmins** (email dropped; DB write still succeeds via RLS). | `supabase/functions/admin-notify/index.ts:45` |
| S4 | Low | `find_member` admin tool interpolates raw input into a PostgREST `.or()` filter (admin-only, read-only — low risk). | `admin-tools.ts:313` |
| S5 | Low | Public rate limiter is in-memory per serverless instance → effective limit far higher than configured across the fleet. Back with Vercel KV/Upstash. | `lib/public-rate-limit.ts` |
| S6 | Low | `export-transcript` lacks the honeypot the sibling public routes use (low-grade open relay of caller content to caller email). | `api/assistant/export-transcript/route.ts` |

### UI / UX
| # | Sev | Issue | Location |
|---|-----|-------|----------|
| U1 | **High** | **Navy-on-navy invisible text**: the task PriorityChip "Normal" (`bg-accent text-ink`) and the "Visible to member" badge render navy-on-navy. "Normal" is the **default** priority, so it shows on most tasks. | `member-tasks-panel.tsx:99, 248` |
| U2 | Low | `accent` button now visually identical to navy primary (gold→navy token collapse); CTA hierarchy lost. | `ui/button.tsx:13` |
| U3 | Low | Welcome-banner body `text-white/70` borderline on maroon for small text. | `welcome-banner.tsx:24` |
| U4 | Low | Dead `page-heading` class on admin h1 (undefined in globals). | `admin/page.tsx:187` |

### Public site / content
| # | Sev | Issue | Location |
|---|-----|-------|----------|
| P1 | Medium | Legacy static `/portal` + `/portal/admin.html` still publicly served and orphaned (stale, SEO dup, exposure surface). | `public/portal/**` |
| P2 | Medium | `/initial-or-renewal` page is orphaned (in sitemap, no inbound link). | `(site)/initial-or-renewal/page.tsx` |
| P3 | Low | Signup consent references "Code of Ethics" + "Terms of Use" with **no links**, and no `/terms`, `/privacy`, `/code-of-ethics` pages exist. | `signup/page.tsx:165`; `site-footer.tsx` |
| P4 | Low | Reminder email subject wording can contradict body ("renews in 0 days"). Blog list has no empty state. | `reminders.ts:113`; `blog/page.tsx:23` |

---

## Recommended wrap-up scope (no scope creep)

**Fix now (make it work):** A1 (name-change bug), U1 (invisible chips), S3 (superadmin email), and the quick polish (U2–U4, P4). These are defects, not features.

**Close before/with launch:** C1 (contact inbox + always-persist) and S1/S2 (add the guard triggers + restrict message UPDATE — same pattern already in the repo). B1/B2 if the owner wants the control-parity rule honored at launch.

**Owner config:** A2 (Stripe seed + keys), A3 (confirm webhook), plus the `ANTHROPIC_API_KEY`/`RESEND_API_KEY`/`CRON_SECRET` from `SETUP-RUNBOOK.md`.

**Defer to "expand":** B3–B8 (admin management of self-entered data), P1/P2 (portal retirement + funnel), P3 (legal pages), S4–S6 (defense-in-depth hardening).
