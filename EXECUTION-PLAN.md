# ABCAC — Deep Assessment, Red-Team & Execution Plan

_Authored after building the platform end-to-end. Snapshot: `main` is green — `tsc` clean, 462 tests, production build passing, migrations 001–032 applied to the live DB._

---

## Part 1 — Where the platform actually is

**Shipped & verified**
- **Public site** (20 pages), **member portal** (`/account/*`), **admin console** (`/admin/*`) — one Next.js app, one Supabase project.
- **22 domain tables** + 3 automation tables, **RLS on every one**; guard triggers on profiles + all request tables; admin audit log extended for automation.
- **Control-parity**: every member-entered surface is admin-viewable *and* editable.
- **AI work-partner** on all three surfaces (answers + admin actions + member plan/update/file-attach + website transcript).
- **Reminders engine** (email + in-portal, deduped) and **Stripe/Resend** integrations (code complete).
- **Automation engine — Phase 0** (decision engine, registry whitelist, approve queue, config console, daily digest, document-vision) — **shipped disabled** (16 workflows `enabled=false`).

**Not yet live (by design — owner config):** `ANTHROPIC_API_KEY`, Stripe keys + `seed:stripe` + webhook endpoint, `RESEND_API_KEY`, `CRON_SECRET`.

---

## Part 2 — Red-Team Findings (deep assessment)

Severity = blast radius **once automation runs unattended**. Each is concrete and located.

### 🔴 Critical (fix before ANY workflow is enabled OR before launch)

**C1 — Stripe price map is empty → 100% of checkouts fail.**
`src/data/stripe-price-map.json` is `{}`, so `getPriceId()` returns undefined and `/api/stripe/checkout` returns `price_not_found` (503). The entire store→pay→issue→portal chain is dead until seeded. _Owner: `npm run seed:stripe` + Stripe keys._

**C2 — Dual Stripe webhook; authoritative endpoint unconfirmed.**
`src/app/api/stripe/webhook/route.ts` (full: writes `payments`, reciprocity, receipts, sync) vs `supabase/functions/stripe-webhook/index.ts` (invoice-only, no `payments` insert). If the Edge function is the registered endpoint, the payments→portal→finance chain silently breaks and reciprocity-fee reconciliation never runs. _Owner: confirm `/api/stripe/webhook` is the Stripe endpoint; retire/align the Edge one._

### 🟠 High (fix during automation Phase 0.5, before turning on propose/auto)

**H1 — `executeApprovedRun` double-execution race (TOCTOU).**
`src/lib/automation/dispatch.ts:203-217`: it reads the run, checks `status === 'pending_approval'`, **runs the action, then** flips status — with no atomic guard. Two concurrent approvals (double-click, two admins) both pass the check and both execute the staged write (e.g., issue a cert twice, send a message twice). Contrast `rejectRun` (`:245`), which correctly guards with `.eq("status","pending_approval")`.
_Fix: claim the row first — `UPDATE … SET status='approved' WHERE id=? AND status='pending_approval'` returning the row; only run the action if the claim affected a row._

**H2 — Approve path ignores the kill switch + global pause.**
`executeApprovedRun` does **not** re-check `automation_global.paused` or the workflow's `enabled` flag. A proposal staged before you paused/disabled a workflow can still be approved and fire. The kill switch only covers `dispatch()`, not execution of already-staged proposals.
_Fix: re-check `isGloballyPaused()` + workflow `enabled` inside `executeApprovedRun` (and inside `dispatch`'s auto path, which already does)._

**H3 — Staged-action args aren't cross-checked against the run's entity/member.**
The registry executors validate their own args (`memberId`, `ceuId`…) but nothing asserts those args match `automation_runs.member_id` / `entity_id`. Since args originate from the agent (and can be steered by **document/model output** in the vision path), a prompt-injected certificate could, in principle, propose an action on a *different* member. The whitelist stops arbitrary writes; it does **not** stop a whitelisted write aimed at the wrong row.
_Fix: in `runAction`/`executeApprovedRun`, assert `args.memberId === run.member_id` and `args.<entityId> === run.entity_id` before executing; reject on mismatch + flag anomaly._

### 🟡 Medium

**M1 — No execute-time re-validation of entity state (stale payload).**
A proposal staged when a CEU was `pending` is executed blindly later even if an admin already changed it. Low harm today (idempotent-ish), but compounds with H1. _Fix: executors re-read current state and no-op/flag if it already moved._

**M2 — `dispatch()` is not wired to any trigger yet (dead code).**
Correct for Phase 0 (inert), but it means **Phase 1 is the real build** — the engine does nothing until submission paths call it.

**M3 — Cert issuance is not gated on payment.**
`issue-cert-form`/`cert-actions` let an admin issue/activate without a paid check. Fine for a human; **planned auto-issuance on (approved AND paid) must add an explicit `payments`/`invoices` paid guard** or it could issue free credentials.

**M4 — Single superadmin = single point of failure.**
`changeMemberRole` correctly refuses self-demotion (anti-lockout), but there's exactly one superadmin (`brianreinhart3617@gmail.com`). No backup; and two superadmins could demote each other. _Fix: seed a second superadmin held in reserve; document recovery via service-role._

**M5 — In-memory rate limiter isn't durable.**
`public-rate-limit.ts` is per-serverless-instance, so the real fleet-wide limit is far higher than configured (spam / Resend-cost amplification). _Fix: back with Vercel KV/Upstash._

### 🟢 Low
- `find_member` admin tool interpolates raw input into a PostgREST `.or()` (admin-only, read-only).
- `export-transcript` lacks the honeypot the sibling public forms use.
- Board-application attachments dropped on the DB-fallback path (email-only).
- Verification *result* (verified/not-verified) not surfaced in the member portal (only status).

### ✅ Verified safe (so the picture is balanced)
- Registry is **fail-closed**: `runAction` refuses any non-whitelisted handler.
- Tiering is safe under bad input: `NaN`/negative confidence → escalate; **any anomaly forces escalate**.
- Vision parser **never throws** — failures return a low-confidence `not_configured`/`parse_error` result.
- RLS present on all tables incl. automation (`031`); `automation_global` writes are superadmin-only.
- Guard triggers stop members from self-approving requests / editing admin messages.
- Stripe webhook (the Next route) verifies signatures + is idempotent on `stripe_event_id`.
- Service-role key is server-only; no secret under a `NEXT_PUBLIC_` name.

---

## Part 3 — Hardening (Phase 0.5) — _do this first_

Small, surgical, no new features. Closes the automation break points so it's safe to enable a workflow:
1. **H1** — atomic claim in `executeApprovedRun`.
2. **H2** — pause + `enabled` re-check in `executeApprovedRun` (and a shared `assertRunnable(workflow)` helper).
3. **H3** — entity/member arg cross-check in `runAction` (+ anomaly flag on mismatch).
4. **M1** — executors re-read state and no-op-if-moved.
5. **M4** — seed a second (reserve) superadmin (owner one-liner; I provide it).
6. Tests for each (claim race, paused-approve rejected, arg-mismatch rejected).

---

## Part 4 — Revised Execution Plan (automation spec folded in)

> Principle unchanged: deterministic work in SQL/functions; Claude only for parsing/judgment; the agent **never** writes except through the whitelisted, audited handlers. Ship every workflow OFF; enable one at a time and watch the digest.

**Phase 0 — DONE.** Engine, registry, tiering, vision, approve queue, config console, digest, tables. Inert.

**Phase 0.5 — Harden (above).** Land H1–H3, M1, M4 + tests. _Gate: cannot enable a workflow until this is merged._

**Phase 1 — Deterministic wins (zero model risk).** Wire `dispatch()` into the real paths + add rule modules + registry executors, then enable one at a time in the config console:
- `credential_verification` (auto Verified/Not-Verified lookup), `certificate_issuance` (**with the M3 paid-guard**), `invoice_generation` (pg_cron/Vercel cron), `payment_reconciliation` (already deterministic — wrap + log), `reminders` (already live — bring under the engine), `dunning` (new escalating sequence), `doc_request` (auto "we need X" on detected gap).
- _Each: rule module → `registerRule` → executor in `registry.ts` → enable flag → watch digest 48h → advance._

**Phase 2 — Agent, low-stakes.** `inbox_faq` auto-reply (no member data), incomplete-app doc requests, Needs-Attention pre-triage summaries (no auto-execute).

**Phase 3 — Agent, propose-and-approve.** Vision-backed `ceu_review`, `account_approval`, `name_change` (ID match), member-specific inbox drafts. Admin's queue becomes approve-clicks.

**Phase 4 — Tune.** Pull two weeks of `automation_runs`; promote propose-bands approved ~100% into auto by raising the config threshold. Repeat. **`reciprocity` and any revocation/appeal/disciplinary action stay permanent-escalate forever.**

**Parallel track (independent):** owner config (C1/C2 + keys), member-portal & admin mobile pass, the Low-severity polish.

---

## Part 5 — Owner config / launch checklist (blocks "live")
- [ ] `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + run `npm run seed:stripe` (C1) + register webhook → `STRIPE_WEBHOOK_SECRET` and confirm it points at `/api/stripe/webhook` (C2).
- [ ] `ANTHROPIC_API_KEY` (AI + vision), `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (email/digest), `CRON_SECRET` (reminders + automation digest).
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` present (admin writes + automation).
- [ ] Seed reserve superadmin (M4).

---

### TL;DR
The platform is solid and the automation **foundation** is sound (fail-closed whitelist, anomaly-trip, audit spine). The real risks are **three execute-path bugs in the newest code (H1–H3)** that must be fixed before any workflow is enabled, plus **two owner-config blockers (Stripe price map + webhook)**. Sequence: **harden (0.5) → wire & enable deterministic (1) → agent propose-approve (3) → tune (4)** — with money/appeals work permanently human-gated.
