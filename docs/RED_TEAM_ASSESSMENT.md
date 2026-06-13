# ABCAC Platform — Red-Team & Workflow Assessment

**Scope:** Both platforms — the **Admin Console** and the **Credential-Holder (member) Portal**.
**Method:** Live simulated workflows in a real browser as a seeded admin and a seeded
credential holder against a production build, plus direct exploit testing against the
live Supabase (PostgREST/RLS/triggers/storage) and a code-level review of every
server action, API route, and security boundary.
**Date:** 2026-06-13

---

## 1. Executive summary

The platform's security posture is **strong**. Authentication, authorization, RLS,
the Stripe webhook, cron protection, the AI assistant tool-scoping, and storage are
all well-designed with genuine defense-in-depth (server actions re-check the admin
role; they do not trust the client or middleware alone).

The assessment exercised **41 routes** (24 admin + 17 member) end-to-end and performed
real mutations (create a task, approve an account, submit a request). Everything works.
Three issues were found and **all three are fixed and verified**:

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **High (functional)** | 3 automation pages crashed with a Server/Client boundary render error | ✅ Fixed + verified live |
| 2 | **High (integrity)** | A member could self-edit `cert_status` / legal name / email on their own profile via direct PostgREST, bypassing the name-change approval workflow | ✅ Fixed (migration 036), applied live + verified |
| 3 | **Low (brand)** | Member-store merch promos appeared in the dashboard "recommended next actions" | ✅ Fixed |

No privilege-escalation, data-exfiltration, payment-tampering, or cross-tenant (IDOR)
vulnerability was found. The two privilege columns that matter most — `portal_role`
and `account_status` — are correctly locked.

---

## 2. Live workflow simulation

### 2.1 Admin Console — exercised as a seeded admin

| System | Workflow exercised | Result |
|--------|--------------------|--------|
| Dashboard / AI Agent | Load KPIs, task queue | ✅ 200, renders |
| **Task management (ClickUp-style)** | Open a member cockpit → fill the Add-task form → submit | ✅ Task created via `createMemberTask` server action, `created_by` = admin, rendered in panel |
| **Account approvals** | Open queue (4 pending) → click **Approve** | ✅ Account approved through `approve-account` action; queue 4 → 3 |
| Members / detail cockpit | Billing, cert, profile, records, supervision, reminders, notify panels | ✅ All load; every action admin-gated |
| CEU review | Queue of 24 pending CEUs | ✅ Renders |
| Automation (engine/config/workflows/runs) | Console, config, workflow index, drilldown, analytics | ✅ (after fix #1) |
| Applications / Requests / Verification | Decision queues | ✅ Render; decisions admin-gated |
| Finance / Invoices / Reports / Exports | Dashboards + CSV export | ✅ Render; exports admin-gated |
| Announcements / Messaging / Inbox / Schedules / Audit / Search | — | ✅ All 200 |

All 24 admin routes returned HTTP 200 with no error boundary and no logout-on-navigation.

### 2.2 Credential-Holder Portal — exercised as a seeded member

| System | Workflow exercised | Result |
|--------|--------------------|--------|
| Dashboard | Recommended next actions, progress | ✅ 200 (content fixed, #3) |
| Onboarding | Pre-approval profile + self-reported certs | ✅ Writes own row; works |
| **Requests** | Submit a name-change request | ✅ 201; lands in admin queue |
| Documents | Upload (PDF/JPG/PNG ≤10MB → private `member-documents` bucket) | ✅ Path namespaced by user id |
| Certifications / CEUs / Invoices / Experience | View own records | ✅ Own-rows only |
| Profile / Settings / Notifications / Activity | View + directory opt-out toggle | ✅ Only `directory_opt_out` writable |

All 17 member routes returned HTTP 200 with no error boundary.

---

## 3. Findings (detail)

### Finding 1 — Automation pages crashed (High, functional) ✅ FIXED
`/admin/automation/workflows`, `/admin/automation/workflows/[id]`, and
`/admin/automation/analytics` threw a Server Components render error
(`(0,d.Py) is not a function` / `u is not a function`) and showed the error boundary
instead of data.

**Root cause:** these Server Components imported *pure functions* (`formatCompact`,
`clampDays`, `ALLOWED_DAYS`, …) from `"use client"` modules. Importing a non-component
export across a `"use client"` boundary yields a client-reference proxy, not the
function — so calling it during server render (and passing it as a prop, which RSC then
tries to serialize) throws.

**Fix (no behavior change):** moved the pure formatters into the server-safe
`src/lib/format.ts`; extracted the analytics window/lens helpers into a server-safe
`analytics-shared.ts`; the client modules re-export them so client importers are
unchanged. Verified in a real browser: all three pages now render their tables/charts.

### Finding 2 — Member could edit identity/credential columns (High, integrity) ✅ FIXED
RLS policy `member_update_own_profile` lets a member UPDATE their own `profiles` row,
and **RLS cannot restrict columns** — so the `guard_profile_update()` trigger is the
column-level boundary. It pinned `portal_role` and `account_status` (privilege
escalation correctly blocked — **verified: a member JWT attempting
`portal_role='admin'` / `account_status='approved'` had no effect**) but did **not**
pin `cert_status`, `email`, `first/middle/last_name`, or `stripe_customer_id`.

A logged-in member, using the public anon key + their own JWT against
`/rest/v1/profiles`, could therefore:
- forge `cert_status` → `active_holder` (drives the public `/directory` + `/verify` listing),
- change the **legal name on an approved credential**, bypassing the
  `name_change_requests` review workflow entirely,
- diverge contact `email` from their auth identity,
- repoint `stripe_customer_id`.

This is **data-integrity / workflow-bypass**, not admin takeover.

**Fix:** migration `036_guard_profile_member_columns.sql` extends the guard to pin these
columns for non-admin callers. Legal name stays editable while the account is still
onboarding (`account_status <> 'approved'`) so the self-service onboarding form keeps
working, and locks once approved. **Verified live:** post-fix an approved member can no
longer change `cert_status`/name/`email`; `phone` self-service still works; onboarding
name entry (pending) still works. Applied to the live database.

### Finding 3 — Off-brand merch in "next actions" (Low, brand) ✅ FIXED
The member dashboard and admin task queue surfaced member-store merch promos
("branded shirts / conference polos — 20% off"; "Approve merch PO"). Replaced with
credentialing-relevant items (member: ethics-CEU reminder → `/account/ceus`; admin:
overdue document request).

---

## 4. Security posture — verified strong (no action needed)

| Area | Verification | Result |
|------|--------------|--------|
| **Cron endpoints** | `/api/cron/*` require `Authorization: Bearer $CRON_SECRET`, fail-closed (503) until set | ✅ anon cannot trigger mass email/automation |
| **Stripe webhook** | `constructEvent` with raw body + `STRIPE_WEBHOOK_SECRET`, fail-closed | ✅ forged events rejected |
| **Admin exports** | `/api/admin/export/*` + announcements check `getUser` + `isAdminRole` | ✅ members/anon get 403 |
| **Admin server actions** | All 14 sensitive action files re-check `isAdminRole` server-side per action (not middleware-only) | ✅ defense-in-depth |
| **Member self-service** | Only `directory_opt_out` writable via the app; `portal_role`/`account_status` blocked by guard trigger | ✅ escalation attempt failed live |
| **AI assistant** | Admin tools require server-verified role (`isAdmin && surface==="admin"`); member tools use the RLS-scoped client bound to own `uid` | ✅ prompt injection cannot cross tenants |
| **RLS coverage** | All 26 public tables RLS-enabled **with** policies; only one `USING(true)` — on `cert_schedules`, a non-sensitive lookup table | ✅ no gaps |
| **IDOR** | Member submitting a request for another `member_id` | ✅ 403 (request-write guard) |
| **Storage** | All 4 buckets private; member read/write scoped to own `auth.uid()` folder | ✅ |

---

## 5. Minor notes (Low / optional, no fix required)

- **Upload validation is by filename extension**, not content-type/magic-bytes
  (`document-upload.tsx`). Low risk — files land in a private bucket and are never
  executed — but content-sniffing would harden it.
- The guard pins `account_review_notes`, so onboarding's attempt to clear them on
  resubmission is silently ignored (cosmetic, no effect).
- `stripe_customer_id` is now pinned for members (closed as part of fix #2).

---

## 6. Changes shipped with this assessment

1. `src/lib/format.ts`, `src/components/agent/charts.tsx`,
   `src/app/(admin)/admin/automation/**` — Finding 1 fix.
2. `supabase/migrations/036_guard_profile_member_columns.sql` — Finding 2 fix (applied live).
3. `src/lib/mock/agent-data.ts` — Finding 3 fix.

`tsc` clean, ESLint clean, full suite (2808 tests) green.
