# ABCAC MASTER PLAN — Single Control Document

> **This is the single source of truth for the ABCAC platform.** It supersedes and
> consolidates every prior planning, gap-analysis, assessment, schema, decisions, and
> go-live document. A multi-agent build sprint runs against the work packages in §6.
>
> Last consolidated: 2026-06-08. Code baseline: `main` @ `118d83d` plus the pending
> `claude/fix-assessment-blockers` branch (PR #56). DB is live and migrated **through
> 023**; migration **024** ships in PR #56 and must be applied on merge.

---

## Table of contents
1. [Overview](#1-overview)
2. [Current State — What's Built](#2-current-state--whats-built)
3. [AI Navigator System](#3-ai-navigator-system)
4. [Remaining Work — Prioritized Backlog](#4-remaining-work--prioritized-backlog)
5. [Manual Owner Steps](#5-manual-owner-steps)
6. [Execution Plan — Multi-Agent Sprint](#6-execution-plan--multi-agent-sprint)
7. [Key Decisions & Schema Pointer](#7-key-decisions--schema-pointer)

---

## 1. Overview

**ABCAC** is the Arizona Board for Certification of Addiction Counselors — an IC&RC member
board that certifies addiction counselors (credentials CAC, CADAC, AADC, CCS, CCJP, CPRS, CPS),
runs initial certification + exam registration, processes 2-year renewals with CEU tracking,
handles IC&RC reciprocity in both directions, and issues official credential verifications.

**The platform is ONE unified Next.js 14 (App Router) application** that serves three surfaces
plus an AI layer, all from a single codebase and a single backend:

- **Public marketing site** — `src/app/(site)/**` (home, cert paths, fees, exams, reciprocity,
  CEU, contact, store).
- **Member portal** — `src/app/(portal)/account/**` (gated; the member's certification journey).
- **Admin console** — `src/app/(admin)/admin/**` (staff: approvals, reviews, issuance, 360° member view).
- **AI Navigators** — three conversational assistants (see §3), served by the single
  serverless route `src/app/api/assistant/route.ts`.

**Backend:** one Supabase project — ref **`ajgqqfggdctmcqhbmptb`** (`https://ajgqqfggdctmcqhbmptb.supabase.co`).
Postgres with RLS on every table, Storage (private buckets), and Edge Functions. Migrations in
`supabase/migrations/001..024` are the **source of truth for the schema**.

**Payments:** Stripe Checkout + a Next.js webhook (`/api/stripe/webhook`). **Email:** Resend
(direct REST, graceful no-op without a key). **Scheduled automation:** Supabase Edge Functions +
pg_cron (an n8n workflow exists as an optional alternative — see §4/§7).

**Deployment:** Vercel — **`abcac.vercel.app`** (Vercel project root = `frontend`... see note*).
**`abcac.org`** is the **old Duda site and is NOT cut over yet** — cutover is a manual owner step.

> \*Historical note: earlier docs reference a `frontend/` root directory and a separate
> `members`/`credentials` data model. The app has since been unified — the canonical data model
> is the portal schema (`profiles`/`certifications`/`payments`/…), and there is no second
> Supabase project. Treat any reference to "two apps" or "members/credentials tables" in deleted
> docs as historical.

---

## 2. Current State — What's Built

Legend: **Done** · **Partial** (code present, gaps noted) · **Pending-DB** (needs a migration
applied) · **Pending-owner** (blocked only on a manual owner/config step, code complete).

### E2E blockers — status
The pre-launch E2E code assessment surfaced four code-level blockers. **All four are FIXED in
PR #56 (`claude/fix-assessment-blockers`), pending merge + applying migration 024:**

| E2E finding | Fix | Status |
|---|---|---|
| #1 `certifications.certificate_url` column missing → all cert issuance fails | migration `024_certifications_certificate_url.sql` | **Fixed (Pending-DB: apply 024)** |
| #4 Name-change approval never wrote `new_name` back to `profiles` | `decide-request.ts` now writes first/last name on approve | **Fixed (in PR #56)** |
| #6 Subscription/`invoice.paid` wrote `member_id: null` (unattributed revenue) | webhook resolves member by `stripe_customer_id` | **Fixed (in PR #56)** |
| #8 Stripe receipt email interpolated user values without `escapeHtml` | receipt vars now escaped | **Fixed (in PR #56)** |

### Public website (`src/app/(site)/**`)
| Area | Status | Notes |
|---|---|---|
| Home (hero, 4 stat cards, 4 service cards) | **Done** | Real copy ported; deep-links to store. |
| Content pages (initial-cert, renewal, CEU, IC&RC, reciprocity, testing, contact, choose-path) | **Done** | All routes render real content; per-page title/meta. |
| Global layout (header, mega-menu, footer, mobile drawer) | **Done** | Single source `lib/nav.ts` + `lib/site-config.ts`; 0 placeholder strings. |
| Store + product detail (`/store`, `/store/[slug]`) | **Done (code)** | 11+ catalog products; checkout wired. Payments gated on Stripe seed (§5). |
| Design system / styleguide | **Done** | Token-driven; `/styleguide` renders the kit. |
| **"Member Portal" header CTA** | **Partial** | `lib/nav.ts` `MEMBER_PORTAL.href` still points at legacy static `/portal`; must repoint to `/account` (Backlog #1). |

### Member portal (`src/app/(portal)/account/**`)
| Surface | Status | Notes |
|---|---|---|
| Personal info / profile | **Done** | Writes `profiles` + `notification_preferences`; password change; completeness %. |
| Employment | **Done** | Add + edit (`employment_records`). No delete (minor). |
| Certificate & wallet card | **Done (Pending-DB for file path)** | Print-to-PDF cert + wallet; downloads admin-uploaded file via signed URL when `certificate_url` set (needs 024). |
| Other certifications | **Done** | Writes `other_certifications` incl. `doc_path` upload. Add-only. |
| Apply (initial) | **Done** | Writes `applications` + uploads to `member-documents`/`documents`; attestation/e-sig. |
| Document upload | **Done** | Storage + `documents`; signed-URL view; admin request→fulfil loop. |
| CEU tracker | **Done** | Writes `ceu_records`; computed KPIs honoring `cert_schedules`; admin approve/reject + email. |
| Renewal + Sync | **Done** | Renewal form; auto $150 invoice; renewals page reads `cert_schedules` (grace-aware). Sync = Stripe sub → `sync_enabled` flag. |
| Clinical supervision | **Done** | `supervision_records`; supervisee modeling added (023). |
| Name change | **Done** | Writes `name_change_requests` + ID `doc_path`; admin preview; approval writes back to profile (PR #56). |
| Verification (member) | **Done** | Dynamic cert select; writes `verification_requests`. |
| Reciprocity OUT / INTO | **Done** | Tailored flows; OUT $150 payment loop reconciled via webhook (`reciprocity_request_id` metadata). |
| Messages | **Done** | Two-way member↔admin; unread counts. |
| Invoices & receipts | **Done** | Reads `invoices`; Stripe pay; webhook mark-paid; downloadable receipt. |
| Account settings | **Partial** | Writes `notification_preferences`; `abcac_announcements` / `icrc_updates` toggles have no sender (Backlog #6). |

### Admin console (`src/app/(admin)/admin/**`)
| Surface | Status | Notes |
|---|---|---|
| Dashboard / reports / finance / compliance | **Done** | Real counts/revenue/CSV exports. |
| Approvals | **Done** | Approve activates certs + emails credentials (username + login link); shows `submitted_cert_numbers`. |
| Members list + **360° detail** | **Done** | Reads every member surface defensively; inline issue-cert, request-doc, message, invoice, status/role. |
| Documents / CEUs / applications | **Done** | Approve/reject + status emails. |
| Requests (name-change, verification, reciprocity) | **Done** | One-click decisions + recipient/board emails. |
| Messaging | **Done** | Full two-way threads + unread badge. |
| **Cert schedules** (`/admin/schedules`) | **Done** | Admin UI to view/edit `cert_schedules` (built in sprint commit 348f05a). |
| Create invoice / audit / search | **Done** | Real. |

### Cross-cutting systems
| System | Status | Notes |
|---|---|---|
| Auth / signup / approval loop | **Done** | `handle_new_user` (006/007/021); middleware gating; `/admin/approvals` + credentials email; certs activate on approve. |
| CEU + `cert_schedules` engine | **Done** | `src/lib/schedules.ts` consumed by renewals/CEU/account pages; per-credential cycle + CEU rules; admin-editable table. |
| Documents + name-change uploads | **Done** | Private Storage buckets + signed URLs. |
| Verification (member + public) | **Done** | Public form `/verify` → `/api/verification`; admin one-click + recipient email. |
| Certificate issuance + download | **Done (Pending-DB)** | `issue-cert-form.tsx` → member download. Requires migration 024 (`certificate_url` column). |
| Stripe (checkout/webhook/portal/invoice-checkout) | **Pending-owner** | Idempotent on `stripe_event_id`; reconciles reciprocity/sync. **Blocked until `stripe-price-map.json` is seeded.** |
| Email (Resend) | **Pending-owner** | All transactional email no-ops silently without `RESEND_API_KEY` + verified `abcac.org` domain. |
| Scheduled reminders / renewal alerts | **Done (Pending-owner deploy)** | `scheduled-reminders` Edge Function (90/60/30-day reminders + auto $150 invoice); deployed manually + pg_cron + Vault secrets. n8n is optional. |
| RLS / security | **Done** | RLS on every table; `is_admin()` override; BEFORE-trigger privilege guards (009/011/014/017/023); service role only behind admin re-checks; escaped email/CSV output. |

---

## 3. AI Navigator System

Three levels of conversational assistant. **Architecture (built):** all three are served by a
single Next.js serverless route — `src/app/api/assistant/route.ts` — calling the **Claude API
directly** (model **`claude-opus-4-8`**, **adaptive thinking**, `effort: medium`, manual
server-side tool-use loop in `src/lib/assistant/run.ts`). **There is NO separate server.** The
only required env var is **`ANTHROPIC_API_KEY`** (plus optional rate-limit / monthly spend-cap
controls — see Backlog). Without the key the route returns 503 and the chat widget degrades
gracefully; `npm run build` passes with no env vars.

Tools run server-side and are role-gated: member tools operate **only** on the caller's own rows
via the RLS-scoped Supabase client; admin tools re-check `is_admin()` before every write. The
client posts message history; the route sanitizes it (text turns only) so a client can't inject
tool_result blocks.

**Built:** the Level 2 (admin) and Level 3 (member) foundations are **merged** (route, tool sets,
manual loop, chat widget). **Left to do:** the Level 1 website assistant (no DB tools, general
knowledge only) is not yet built; and each assistant's system prompt is currently a short inline
string — it must be **wired from the navigator instructions below** (replace the inline
`MEMBER_SYSTEM`/`ADMIN_SYSTEM` constants and add the website system prompt).

### Level 1 — Website / Public Assistant
- **Audience:** anonymous public visitors on the marketing site (abcac.vercel.app / abcac.org).
- **Auth:** none.
- **Data access:** **NONE** — must never read or expose any member's account. General knowledge + page links only.
- **Capabilities:** answer questions about ABCAC, certification paths, fees, exams, IC&RC, reciprocity, CEUs; guide visitors to the right page or to sign up.
- **Tools:** none (knowledge + navigation only).
- **Status:** **Pending** — not yet built (route currently serves only authenticated member/admin surfaces).

### Level 2 — Admin "AA Company Navigator"
- **Audience:** ABCAC staff/admins inside `/admin/*`.
- **Auth:** admin only — every tool re-checks `is_admin()` server-side.
- **Data access:** any member (service-role client behind admin gate).
- **Capabilities:** look up any member, take administrative actions by chat, answer operational/process questions.
- **Tools (built):** `get_dashboard_counts`, `list_pending_approvals`, `list_pending_ceus`, `list_pending_documents`, `list_pending_requests`, `find_member`, `get_member_overview`, `approve_account`, `reject_account`, `approve_ceu`, `reject_ceu`, `issue_certification`, `decide_verification`, `send_message_to_member`, `create_invoice`.
- **Status:** **Built (foundation)** — needs its system prompt wired from §3 Admin instructions.

### Level 3 — Member / Certificate-Holder Navigator
- **Audience:** logged-in certificate holders inside `/account/*`.
- **Auth:** the signed-in member only — every tool is RLS-scoped to THEIR OWN data.
- **Data access:** own rows only (auth.uid()). Given name/credentials/status/CEU progress/next-renewal as context.
- **Capabilities:** know where the member is in their journey, recommend next steps, take actions (log CEUs, submit requests, message the office).
- **Tools (built):** `get_my_overview`, `get_my_ceu_status`, `get_my_renewals`, `get_my_documents`, `get_my_invoices`, `get_my_messages`, `get_my_requests`, `log_ceu`, `submit_name_change`, `submit_verification_request`, `start_reciprocity`, `send_message_to_admin`, `update_my_profile`.
- **Status:** **Built (foundation)** — needs its system prompt wired from §3 Member instructions.

---

### Navigator Instructions (owner-filled)

> The three subsections below are the **fill-in scaffolding** where the owner pastes their
> custom-GPT content. The build wires each assistant's system prompt from the matching subsection.
> Template prompts are preserved verbatim from the original `docs/ai/*-navigator.md` templates.

#### 3.A — Website Navigator Instructions (Level 1)

> **Audience:** anonymous public visitors on the marketing website (abcac.vercel.app / abcac.org).
> **Auth:** none. **Personal data access:** NONE — this assistant must never read or expose any member's account.
> **Purpose:** answer general questions about ABCAC, certification paths, fees, exams, reciprocity, CEUs,
> and guide visitors to the right page or to sign up.

This section is the **single source of truth** for this assistant's persona, knowledge, and rules. Paste the
content from your existing front-end custom GPT below. Everything between the markers becomes the system
prompt + knowledge base the assistant loads at runtime.

##### 1. Identity & persona
<!-- Who is this assistant? Name, voice, tone. e.g. "You are the ABCAC Website Guide..." -->


##### 2. Scope (what it answers) & out-of-scope (refer to staff/contact)
<!-- What topics it covers; when to hand off to the contact page / office. -->


##### 3. Knowledge base (paste your custom GPT knowledge here)
<!-- Certification types & requirements, fees, exam/IC&RC info, reciprocity, CEU rules, FAQs, contact info.
     Paste verbatim from your custom GPT. -->


##### 4. Guardrails
<!-- e.g. never give legal advice; never claim to access an account; never quote a fee you're unsure of —
     direct to the Store/Contact instead; no medical/clinical advice. -->


##### 5. Tone & style
<!-- Short/friendly? formal? emoji or none? -->


##### 6. Example questions → ideal answers
<!-- 3–6 examples so we can validate behavior. -->

<!-- BUILD NOTE (do not delete): the assistant route reads everything above as its system prompt.
     Keep it self-contained — it has no DB tools at this level, only general knowledge + page links. -->

#### 3.B — Admin Navigator Instructions (Level 2 — "AA Company Navigator")

> **Audience:** ABCAC staff/admins inside `/admin/*`.
> **Auth:** admin only — every action re-checks `is_admin()` server-side.
> **Purpose:** let staff look up any member and take administrative actions by chatting, plus answer
> operational/process questions in the voice of your existing "AA Company Navigator" custom GPT.

This section is the **single source of truth** for the admin assistant's persona, knowledge, and rules.
Paste the content from your "AA Company Navigator" custom GPT below. It becomes the system prompt the
admin assistant loads at runtime, layered on top of the live admin tools.

##### 1. Identity & persona
<!-- e.g. "You are the AA Company Navigator, ABCAC's internal operations assistant for staff..." -->


##### 2. What it should help staff do
<!-- e.g. clear the approval queue, review CEUs, issue credentials, answer policy/process questions. -->


##### 3. Knowledge base (paste your AA Company Navigator GPT content here)
<!-- Internal policies, SOPs, certification rules, fee schedule, review criteria, escalation rules. -->


##### 4. Action confirmation rules
<!-- e.g. always confirm member name + specifics before approving/rejecting/issuing/invoicing;
     never take a destructive action without explicit "yes". -->


##### 5. Guardrails
<!-- e.g. never fabricate a member record; never bypass the approval workflow; flag uncertainty. -->


##### 6. Tone & style


##### 7. Example requests → ideal handling
<!-- e.g. "Approve Brian's account" → confirm which Brian, then approve + summarize. -->

<!-- BUILD NOTE (do not delete): the admin assistant route loads this as its system prompt, on top of the
     admin tool set (find_member, get_member_overview, approve/reject account, approve/reject CEU,
     issue_certification, decide_verification, send_message_to_member, create_invoice, dashboard counts).
     Tools enforce is_admin() server-side regardless of anything written here. -->

#### 3.C — Member Navigator Instructions (Level 3 — Certificate-Holder)

> **Audience:** logged-in certificate holders inside their member portal (`/account/*`).
> **Auth:** the signed-in member only — every tool is RLS-scoped to THEIR OWN data. It can never see or act
> on anyone else's account.
> **Purpose:** a personal guide that knows where the member is in their certification journey, recommends
> their next steps, and can take actions for them (log CEUs, submit requests, message the office) — in the
> voice of your certificate-holder custom GPT.

This section is the **single source of truth** for the member assistant's persona, knowledge, and rules.
Paste your certificate-holder custom GPT content below. It becomes the system prompt, layered on top of the
member's live data (the assistant is given their name, credential(s), cert status, CEU progress, and next
renewal date as context, and has tools to fetch more).

##### 1. Identity & persona
<!-- e.g. "You are the ABCAC Member Navigator, a friendly guide for certificate holders..." -->


##### 2. What it helps members do
<!-- Understand their status, know what's due and when, take the right next step. -->


##### 3. Knowledge base (paste your certificate-holder GPT content here)
<!-- Certification & renewal rules, CEU requirements (Ethics/Cultural/total per credential), the application
     process, reciprocity, fees, deadlines, what each status means, how to read their dashboard. -->


##### 4. "Recommend next steps" logic
<!-- How should it prioritize advice given their state? e.g.
     - If account pending → tell them what approval means + ETA.
     - If applying → list remaining application/document steps.
     - If active & renewal within 90 days → CEUs remaining + how to renew + sync option.
     - If CEUs short → exactly how many hours in which category, and where to log them. -->


##### 5. Action confirmation rules
<!-- e.g. confirm details before logging a CEU, submitting a name change, starting reciprocity, or messaging
     the office; never submit on the member's behalf without a clear "yes". -->


##### 6. Guardrails
<!-- e.g. never reveal another member's data; never promise an approval outcome; no legal/clinical advice;
     for anything it can't do, point to the right page or the office. -->


##### 7. Tone & style


##### 8. Example questions → ideal answers
<!-- e.g. "What do I need to do next?" / "How many CEUs am I missing?" / "When do I renew?" -->

<!-- BUILD NOTE (do not delete): the member assistant route loads this as its system prompt, on top of the
     member tool set (get_my_overview, get_my_ceu_status, get_my_renewals, get_my_documents, get_my_invoices,
     get_my_messages, get_my_requests, log_ceu, submit_name_change, submit_verification_request,
     start_reciprocity, send_message_to_admin, update_my_profile). All tools use auth.uid() server-side —
     they only ever touch the signed-in member's rows. -->

---

## 4. Remaining Work — Prioritized Backlog

De-duplicated and reconciled against current code. Items already fixed in PR #56 or earlier
sprints are **not** listed (cert issuance column, name-change writeback, webhook attribution,
receipt escaping, reciprocity OUT payment loop, admin cert_schedules UI, schedules wiring,
supervisee modeling, two-way messaging, verification, name-change upload — all done). Size:
**S**(small) / **M**(medium) / **L**(large). Tag: **[code]** or **[owner]**.

| # | Item | Size | Tag | Detail / files |
|---|---|---|---|---|
| 1 | **Repoint "Member Portal" header CTA `/portal` → `/account`** | S | code | E2E #2. `src/lib/nav.ts` `MEMBER_PORTAL.href` still hardcodes the legacy static `/portal`; the headline CTA lands members in the deprecated parallel app. One-line fix (or use `NEXT_PUBLIC_PORTAL_URL`). |
| 2 | **Build the Level-1 Website AI assistant** | M | code | §3 Level 1. Add a public (no-auth, no-tools) branch to `/api/assistant` + a public chat widget; wire its system prompt from §3.A. |
| 3 | **Wire all three navigator system prompts from §3** | M | code | Replace inline `MEMBER_SYSTEM`/`ADMIN_SYSTEM` in `route.ts` with the §3.B/§3.C content; add §3.A for Level 1. Source the instruction text from this doc (or a loader). |
| 4 | **Assistant rate-limit + monthly spend cap** | S–M | code | §3 architecture. Add per-user/IP rate limiting and an optional spend ceiling around the Anthropic call so the public assistant can't be abused. |
| 5 | **Retire / gate the legacy static portal** | S–M | code | E2E #11. `public/portal/{index.html,admin.html,...}` (~4,400 lines) is a parallel app served via `next.config.mjs` rewrites. Remove it (and the rewrites) once #1 lands, or keep behind a flag. |
| 6 | **Wire or hide the dead notification toggles** | S | code | GAP #8 / E2E #9. `abcac_announcements` + `icrc_updates` in `notification_preferences` are saved/shown but no sender reads them. Either build an announcement/IC&RC sender that honors them, or hide the toggles. |
| 7 | **Log errors in admin-360 `safeList`/`safeOne`** | S | code | E2E #5. Helpers `catch`/return `[]` on any error → an RLS/query failure shows as "No records." Now that the DB is fully migrated, log instead of silently empty. |
| 8 | **Per-credential KPI in admin-360 CEU view** | S | code | E2E #7. `members/[id]/page.tsx` hardcodes `/40 /3 /3`; member renewals page already honors `cert_schedules`. Parameterize the admin denominators by the member's schedule row. |
| 9 | **Rate-limit / CAPTCHA public `/api/contact` + `/api/verification`** | S | code | E2E #12. Both do service-role inserts with no abuse protection. |
| 10 | **Edit/delete CRUD polish** | S | code | Other-certs, supervision, and most request rows are add-only. Low priority. |
| 11 | **Server-rendered binary PDFs (optional)** | M | code | GAP #9. Receipts/certificates are print-to-PDF; only needed if attachable PDF files are required. |
| 12 | **n8n `ABCAC-01-RENEWAL-ALERTS` RPC** | S–M | owner/code | GAP #7. The optional n8n workflow needs the `cert_renewal_candidates` view/RPC (migration 022 added `cert_renewal_candidates`; confirm the n8n node points at it). Prefer the deployed `scheduled-reminders` Edge Function and skip n8n unless the owner requires it — **run one, not both** (double-send risk). |

> Owner-step items that gate launch but are not code (Stripe seed, env vars, domain, Edge Function
> deploy, schedule import, admin promote) live in §5, not here.

---

## 5. Manual Owner Steps

These are config/deploy steps the code expects an owner to perform. The app degrades gracefully
until each is done.

1. **Apply the migration bundle through 024.** Apply `001..018, 021, 022, 023, 024` in order
   (Supabase SQL editor or `supabase db push`). DB is already live through 023; **024
   (`certifications.certificate_url`) ships in PR #56 and must be applied on merge** to unblock
   certificate issuance. Numbering skips 019/020 (no such files — expected). All additive/idempotent.
2. **Seed Stripe prices** (unblocks ALL payments). Run `STRIPE_SECRET_KEY=sk_... npx tsx scripts/seed-stripe.ts`
   against the live Stripe account; commit/deploy the resulting `src/data/stripe-price-map.json`
   (currently `{}` → every checkout returns 503). Verify `icrc-reciprocity-transfer`,
   `certification-sync`, and the renewal-fee slug all get price IDs.
3. **Add the Stripe webhook endpoint** `https://<domain>/api/stripe/webhook` for
   `checkout.session.completed` + `invoice.paid`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
   Point Stripe at the **Next.js** route (the Supabase `stripe-webhook` function is legacy).
4. **Set env vars** (Vercel + `.env.local`): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, **`RESEND_API_KEY` +
   `RESEND_FROM_EMAIL`**, **`ANTHROPIC_API_KEY`** (enables the AI navigators), and
   `NEXT_PUBLIC_PORTAL_URL=/account`.
5. **Verify the `abcac.org` sending domain in Resend** (without it, all member/requester email
   silently no-ops).
6. **Deploy Edge Functions + pg_cron + Vault secrets:** deploy `admin-notify`, `events`,
   `scheduled-reminders` (+ legacy `create-checkout`/`stripe-webhook`); set their secrets; create
   Vault secrets `edge_functions_url` + `service_role_key` (gate the DB notify triggers); the daily
   `abcac-daily-reminders` cron is created by migration 003.
7. **(Optional) Import the n8n workflow** `n8n/ABCAC-01-RENEWAL-ALERTS.json` — only if the owner
   requires n8n; first create the `cert_renewal_candidates` view/RPC it queries. Otherwise rely on
   `scheduled-reminders`. Do not run both.
8. **Load the due-dates spreadsheet** into `cert_schedules`: export to CSV with the exact header
   and run `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-cert-schedules.ts`
   (idempotent upsert keyed on `credential_type`). Confirm CPRS/CPS placeholder rows against the real schedule.
9. **Create / verify the admin login:** after the admin signs up + confirms email, promote them —
   `update public.profiles set portal_role='admin', account_status='approved' where email='abcac@abcac.org';`
10. **Configure Supabase Auth:** Site URL = prod domain; add `/auth/callback` redirect URLs (prod +
    Vercel preview + `http://localhost:3000`); enable email confirmations.
11. **Cut over `abcac.org`** to the Vercel app when ready (currently the old Duda site).

---

## 6. Execution Plan — Multi-Agent Sprint

Disjoint work packages by file-scope, ready to hand to parallel agents. Each is independent (no
two touch the same files) except where a dependency is noted. Migration numbers are pre-assigned to
avoid collisions; next free number is **025**.

| WP | Title | Scope (files) | Backlog items | Migration | Notes |
|----|-------|---------------|---------------|-----------|-------|
| **WP-A** | Portal entry-point fix | `src/lib/nav.ts`, `src/components/site-header.tsx` | #1 | — | One-line repoint `/portal` → `/account`; verify header desktop + mobile. Smallest, highest-impact. |
| **WP-B** | Website AI assistant (Level 1) | `src/app/api/assistant/route.ts` (public branch), new `src/components/assistant/public-chat-widget.tsx`, public-prompt loader | #2, #3(Level 1) | — | No DB tools; reads §3.A. Depends on WP-C for the prompt-wiring pattern (coordinate or sequence after WP-C). |
| **WP-C** | Wire navigator system prompts | `src/app/api/assistant/route.ts` (replace `MEMBER_SYSTEM`/`ADMIN_SYSTEM`), prompt source/loader | #3 (Levels 2 & 3) | — | Source prompts from §3.B/§3.C. |
| **WP-D** | Assistant hardening | new `src/lib/assistant/rate-limit.ts`, wrap in `route.ts` + `run.ts` | #4 | — | Per-user/IP rate limit + optional spend cap. Coordinate the `route.ts` edit window with WP-B/WP-C (shared file → sequence these three or split by clearly-separated regions). |
| **WP-E** | Notifications: announcements/IC&RC sender | `supabase/functions/scheduled-reminders/index.ts` (or new sender fn), `src/components/.../notification-settings.tsx` | #6 | — | Honor `abcac_announcements` + `icrc_updates`, or hide the toggles. |
| **WP-F** | Admin-360 correctness | `src/app/(admin)/admin/members/[id]/page.tsx` | #7, #8 | — | Log errors in `safe*`; per-schedule CEU denominators. |
| **WP-G** | Public-endpoint hardening | `src/app/api/contact/route.ts`, `src/app/api/verification/route.ts`, shared limiter | #9 | — | Rate-limit/CAPTCHA. Can reuse WP-D's limiter (sequence after WP-D or build standalone). |
| **WP-H** | Retire legacy static portal | remove `public/portal/**`, `index.html`/`admin.html`, `next.config.mjs` rewrites | #5 | — | **Depends on WP-A** (CTA must be repointed first). |
| **WP-I** | (Optional) Binary PDF artifacts | `src/components/.../receipt-download.tsx`, `certificate-actions.tsx`, new `/api/pdf` route | #11 | 025 (if a `certificates`/`receipts` artifact table is wanted) | Only if the owner requires attachable PDFs. |
| **WP-J** | CRUD polish | `other_certifications` / `supervision` / request edit-delete UIs | #10 | — | Low priority; fully independent. |

**Sequencing summary:** WP-A first (fast, unblocks WP-H). WP-C → WP-B → WP-D share `route.ts`, so
run them in that order or carve the file into non-overlapping regions. WP-E/F/G/J are fully
parallel. WP-H after WP-A. WP-I optional/last.

**Migration ledger:** used 001–018, 021–024. Free from **025**. Assign sequentially to whichever WP
needs schema; only WP-I (optional) is currently anticipated to need one.

---

## 7. Key Decisions & Schema Pointer

### Key decisions (canonical)
- **One Supabase project: `ajgqqfggdctmcqhbmptb`.** Never create a second.
- **No separate `members`/`credentials` tables.** `member_id` everywhere = `profiles.id` =
  `auth.users.id` (`auth.uid()`). `certifications` is the system of record for ISSUED credentials;
  `other_certifications` holds member-recorded EXTERNAL credentials.
- **Payment is decoupled from certification.** Paying a fee never auto-grants/renews a credential —
  ABCAC staff issue via `/admin/members` after review. The **only** automatic payment side effect
  is enabling Certification Sync (`sync_enabled=true` for `slug==='certification-sync'`, a $15/mo sub).
- **`certifications` is member-read-only** (013); members self-report existing cert numbers at
  signup into `profiles.submitted_cert_numbers` (021), which admins verify before approval.
- **Approval emails the username (email) + a login link, never a password** (Supabase hashes
  passwords; no plaintext exists).
- **`account_status` defaults to `'approved'`** at the column level (007) to avoid locking out
  existing members; only `handle_new_user` sets new signups to `'pending'`.
- **Resend is the email provider** (graceful no-op without a key; `/api/contact` +
  `/api/board-application` fall back to `contact_messages`).
- **Automation = Supabase Edge Functions + pg_cron + Resend** (the deployed implementation). The
  n8n `ABCAC-01-RENEWAL-ALERTS` workflow is an **optional** alternative — run one, not both.
- **`cert_schedules` (016) is the per-credential rules table** (cycle length, CEU totals, grace) —
  now wired into renewals, CEU compliance, and reminders, and editable at `/admin/schedules`.
  (Note: the deleted `DECISIONS.md`/`SCHEMA-CURRENT.md` claimed "no `cert_schedules`" — that was
  written pre-016 and is superseded by this document.)
- **Stripe webhook is idempotent** on `payments.stripe_event_id` (UNIQUE); reconciles reciprocity
  OUT via `reciprocity_request_id` metadata and Sync via the `certification-sync` slug.
- **AI navigators** call the Claude API directly from the Next.js `/api/assistant` route
  (`claude-opus-4-8`, adaptive thinking, manual tool-use loop); no separate server; member tools
  RLS-scoped, admin tools re-check `is_admin()`.

### Schema pointer (migrations are the source of truth — `supabase/migrations/001..024`)
Project ref `ajgqqfggdctmcqhbmptb`. RLS on every table (member-own policy OR `is_admin()` admin policy).

**Tables:** `profiles` (PK = auth user id; `submitted_cert_numbers` 021, `stripe_customer_id` 011,
`account_status` 007), `certifications` (system of record; `sync_enabled` 004; read-only to members
013; `certificate_url` 024), `ceu_records`, `documents`, `employment_records`,
`other_certifications`, `supervision_records` (supervisee modeling 023), `applications`
(attestation/e-sig 005), `name_change_requests`, `verification_requests` (`completed_at`),
`reciprocity_requests` (OUT/INTO + payment cols 017), `messages` (two-way, hardened 009/014),
`invoices`, `notification_preferences`, `admin_audit_log` (002), `payments` (004; idempotency via
`stripe_event_id`; `member_id ON DELETE SET NULL`), `contact_messages` (004), `document_requests`
(010), `cert_schedules` (016, per-credential rules).

**Functions/triggers:** `handle_new_user` (001→006→007→021), `is_admin()` (002),
`update_updated_at()` (001), `notify_events()` (003→012, PII-trimmed), `guard_profile_update()`
(009/011), `guard_message_insert` (014), `guard_reciprocity_write` (017), supervision guard (023),
`cert_renewal_candidates` (022). pg_cron `abcac-daily-reminders` (003).

**Storage (002, all private):** `member-documents`, `ceu-certificates`, `name-change-docs`;
member INSERT/SELECT gated by `auth.uid()::text = (storage.foldername(name))[1]`; admin SELECT on all.

**Edge Functions:** `events`, `scheduled-reminders`, `admin-notify`, `create-checkout` (legacy),
`stripe-webhook` (legacy — use the Next.js route).

---

*Maintained as the single control document for ABCAC. Update this file in place; do not re-scatter
status across new docs.*
