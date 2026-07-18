# ABCAC — Ship Plan (What It Takes to Launch)

> **Purpose.** A single, current-code answer to: *"what is left to ship the whole platform —
> member portal + admin console — end to end?"* This supersedes the older planning docs
> (`MASTER-PLAN.md`, `ASSESSMENT.md`, `EXECUTION-PLAN.md`, `PORTAL-PARITY.md`), which were written
> against migration 024 / early June and have **drifted** from the code (now at migration 036).
>
> **Verified baseline (this review, 2026-07-16):** `main` @ `311e566`; migrations `001–036`
> present; `tsc --noEmit` **clean**; **936 tests / 73 files green** (`npm run test`); no `next build`
> run in this pass. There is **no GitHub CI** — those green numbers are local only.

---

## 1. TL;DR — the platform is ~90% built; shipping is mostly *config + finishing 4 things*

The heavy lifting is done. The three surfaces (public site, member portal `/account/*`, admin console
`/admin/*`), the AI navigators, the automation engine, notifications, the public directory, and a
portal visual redesign are all **in the codebase and pass the test suite**. Every security defect the
old audits flagged (name-change crash, member self-mutation of profile/status columns, request-table
write bypass, message tampering) is **fixed** in migrations `029`/`036` and current server actions.

What actually stands between here and "live":

| # | Blocker | Type | Where |
|---|---------|------|-------|
| **B1** | **Owner config** — Stripe price map is `{}` (every checkout 503s), plus all API keys, webhook, Resend domain, Edge Function deploy, admin promote, domain cutover | **Owner / config** | [`docs/ship/01-owner-config.md`](docs/ship/01-owner-config.md) |
| **B2** | **Four surfaces render mock/demo data** — admin **Reports**, admin **AI Agent workspace**, member **AI Agent panel**, **task rail** all read `src/lib/mock/agent-data.ts`, not Supabase | **Code** | [`docs/ship/02-code-work.md`](docs/ship/02-code-work.md) |
| **B3** | **Legacy static portal still shipped** — `public/portal/{index,admin}.html` served via `next.config.mjs` rewrites (orphaned parallel app) | **Code** | [`docs/ship/02-code-work.md`](docs/ship/02-code-work.md) |
| **B4** | **Legal pages missing** — signup consent links to Code of Ethics / Terms that don't exist (`/terms`, `/privacy`, `/code-of-ethics`) | **Code + owner content** | [`docs/ship/02-code-work.md`](docs/ship/02-code-work.md) |
| **B5** | **Automation is shipped OFF** — 16 workflow modules exist but disabled; needs phased, guarded enablement (or explicit "launch with it off") | **Code + ops decision** | [`docs/ship/03-automation-rollout.md`](docs/ship/03-automation-rollout.md) |

Everything else is polish/hardening, not a blocker. Go/no-go criteria and a smoke-test script are in
[`docs/ship/04-launch-readiness.md`](docs/ship/04-launch-readiness.md).

---

## 2. What is actually built (verified in code this pass)

**Public site** — 20+ routes under `src/app/(site)/**` (home, cert paths, fees, exams, IC&RC,
reciprocity, CEU, store + product detail, contact, verify, directory, blog, board-application).

**Member portal** — `src/app/(portal)/account/**`: profile, employment/experience, certifications +
wallet, other-certs, apply + applications, documents (+ admin doc-requests), CEU tracker
(schedule-aware compliance), renewals + renew + Stripe sync, clinical supervision (two-way), name
change, verification, reciprocity (in/out + $150 fee), messages, invoices, notifications, activity,
onboarding, settings. New portal **chrome landed**: `portal-shell`, `portal-sidebar`, `portal-topbar`,
`notification-bell` (the `PORTAL-PARITY.md` redesign is no longer pending).

**Admin console** — `src/app/(admin)/admin/**`: dashboard, approvals, members + 360° detail, documents,
CEUs, applications, requests, messaging, inbox (contact_messages consumer — the old "contact never
reaches console" gap is closed), invoices, finance, reports, compliance, schedules, announcements,
audit, search, **agent** workspace, and a full **automation** area (engine/config/workflows/runs/
analytics/audit).

**AI navigators (all 3 levels wired)** — `src/app/api/assistant/route.ts` + `src/lib/assistant/*`:
website (Level 1, no DB tools), admin (Level 2), member (Level 3). System prompts are **wired** from
`prompts.ts` (`WEBSITE/MEMBER/ADMIN_SYSTEM_DEFAULT`) — no longer inline stubs. Per-user/IP
**rate-limiting exists** (`rate-limit.ts`). Tools are role-scoped (member = RLS-bound own rows; admin
re-checks `is_admin()`).

**Automation engine** — `src/lib/automation/*`: `dispatch.ts` (atomic-claim on approval — the
double-execution race is fixed), `config.ts` (`assertRunnable`, global pause), `registry.ts`
(fail-closed whitelist), `sweep.ts`, `vision.ts`, `digest.ts`, `analytics.ts`, plus **16 workflow
modules** under `workflows/` (account-approval, certificate-issuance, ceu-review, credential-
verification, doc-request, dunning, inbox-faq, inbox-member, invoice-generation, name-change,
payment-reconciliation, print-request, reciprocity, refund-void, cert-sync). Cron routes exist
(`/api/cron/reminders`, `/api/cron/automation-digest`, `/api/cron/automation-sweep`) and are wired in
`vercel.json`.

**Schema** — migrations `001–036`: role tiers (025/026/033), member tasks (027), reminder log (028),
request write-guards (029), supervision authorizations (030), automation tables (031/032),
notifications (034), public directory (035), profile-column guard (036).

---

## 3. The path to ship (recommended sequence)

```
┌── Track A: OWNER CONFIG (parallel, no code) ───────────────────────┐
│  Stripe seed+keys+webhook → Resend domain → env keys → Edge deploy │
│  → cert-schedules import → admin promote → Supabase Auth → domain  │  → see 01
└────────────────────────────────────────────────────────────────────┘
┌── Track B: CODE TO LAUNCH (this is the real dev work) ─────────────┐
│  1. Decide mock surfaces: wire-to-real OR hide behind flag (B2)     │
│  2. Retire/gate legacy static portal (B3)                           │
│  3. Add legal pages + wire consent links (B4)                       │
│  4. Add GitHub CI (tsc + test + build on PR)                        │  → see 02
└────────────────────────────────────────────────────────────────────┘
┌── Track C: AUTOMATION (decision, then phased) ────────────────────┐
│  Launch with automation OFF, OR run Phase 1 deterministic wins      │  → see 03
└────────────────────────────────────────────────────────────────────┘
                              ↓
              Launch readiness gate + smoke test  → see 04
```

**Fastest real path to a defensible launch:** Track A (owner) in parallel with Track B items 1–3,
launch with **automation OFF** (Track C deferred), CI added for safety. Estimated code effort for
Track B ≈ **3–6 focused days** depending on the mock-data decision (hide = hours; fully wire = days).
Track A is owner-gated and can be same-day once credentials are in hand.

---

## 4. Document map

| File | Contents |
|------|----------|
| `SHIP-PLAN.md` (this) | Overview, verified state, sequence |
| `docs/ship/01-owner-config.md` | Every non-code step (keys, Stripe, Resend, Edge, DB, domain) as a checklist |
| `docs/ship/02-code-work.md` | Remaining code work, file-scoped, with acceptance criteria |
| `docs/ship/03-automation-rollout.md` | Phased, guarded enablement of the automation engine |
| `docs/ship/04-launch-readiness.md` | Go/no-go criteria + end-to-end smoke test |
| `docs/ship/05-pr-disposition.md` | All 155 PRs audited: 150 merged, 1 lost (#13), 3 open stale duplicates to close (#150/#153/#155) |

> **Housekeeping:** once this plan is accepted, mark `MASTER-PLAN.md`, `ASSESSMENT.md`,
> `EXECUTION-PLAN.md`, `PORTAL-PARITY.md` as historical (or delete) so there is one source of truth.
