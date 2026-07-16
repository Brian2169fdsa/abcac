# 02 — Remaining Code Work to Launch

Scoped, file-level work. Each item has a **decision**, the **files**, and **acceptance criteria**.
The codebase is clean of stray `TODO`/`FIXME` cruft (the `todo` hits in grep are plan-status enums),
`tsc` is clean, and 936 tests pass — so this is *finishing*, not firefighting.

---

## C1 — Mock/demo data on four live surfaces 🔴 (biggest code gap)

Four shipped surfaces render the **demo dataset** `src/lib/mock/agent-data.ts`
(`MOCK_MEMBERS`, `MOCK_TASKS`, revenue/cert series), not Supabase:

| Surface | File | What's mock |
|---------|------|-------------|
| Admin **Reports** (`/admin/reports`) | `src/components/admin/reports-dashboard.tsx` | Entire dashboard dataset |
| Admin **AI Agent workspace** (`/admin/agent`) | `src/components/agent/admin-agent-workspace.tsx` | Member roster + task cards (chat via `/api/assistant` **is** real) |
| Member **AI Agent panel** (`/account`) | `src/components/agent/member-agent-panel.tsx` | Panel data tiles |
| **Task rail** | `src/components/agent/task-rail.tsx` | `MOCK_TASKS` |

> PR **#150** (open) is the *older mock-data* iteration of the admin workspace — `main` already has
> the newer real-data wiring from #149. **Close #150 unmerged** (see `05-pr-disposition.md`); the
> remaining work is finishing the live-data wiring in `main`, below.

**Decision required (pick one):**
- **(A) Hide for launch** — feature-flag these four surfaces off (or route them to an "coming soon"
  state) so nothing demo-looking ships. *Effort: hours.* Lowest risk to launch.
- **(B) Wire to real data** — replace `MOCK_*` reads with Supabase queries (Reports can reuse the
  same aggregation the admin dashboard/finance pages already do; task rail → `member_tasks` table
  from migration 027; agent roster → `profiles`). Land/repurpose PR #150. *Effort: 2–4 days.*

**Acceptance:** no import of `@/lib/mock/agent-data` remains in any shipped route (grep clean), OR the
mock-backed routes are provably unreachable behind a flag. Add a test asserting the chosen state.

---

## C2 — Retire or gate the legacy static portal 🟠

`public/portal/{index.html,admin.html,js/**}` is an orphaned parallel app, still served via
`next.config.mjs` rewrites (`/portal`, `/portal/admin`). The real portal is the Next.js `/account` +
`/admin` app; the header CTA already points at `/account`.

**Do:**
- [ ] Remove the `rewrites()` entries in `next.config.mjs`.
- [ ] Delete `public/portal/**` (or move behind an env flag if a fallback is wanted during cutover).
- [ ] Grep for any remaining internal links to `/portal` or `/portal/admin`.

**Acceptance:** `/portal` and `/portal/admin` 404 (or redirect to `/account` / `/admin`); no build
warning; no inbound link references the static files.

---

## C3 — Legal / compliance pages 🔴 (for a certification board, treat as blocker)

`src/app/signup/page.tsx` consent text references a **Code of Ethics** and **Terms of Use**, and the
footer references legal links, but **no `/terms`, `/privacy`, or `/code-of-ethics` routes exist**.

**Do:**
- [ ] Add `src/app/(site)/terms/page.tsx`, `privacy/page.tsx`, `code-of-ethics/page.tsx` (owner
  supplies the copy; scaffold with the site layout + real content slots).
- [ ] Wire the signup-consent + footer links to them.
- [ ] Add to `sitemap`.

**Acceptance:** every consent/footer legal link resolves to a real page with owner-approved content.

---

## C4 — Add GitHub CI 🟠

There is **no `.github/workflows/`** — the "tests green" state is only ever checked locally, so a
regression can merge silently. This is cheap insurance before opening the platform.

**Do:**
- [ ] Add a workflow running on PR + push to `main`: `npm ci` → `npx tsc --noEmit` → `npm run test`
  → `npm run build`.
- [ ] (Optional) require it as a status check on `main`.

**Acceptance:** a PR shows a green (or red) check; a deliberately broken type fails CI.

---

## C5 — Polish / defense-in-depth 🟢 (not blockers; do opportunistically)

These were flagged by prior audits and remain reasonable; none block launch:

- [ ] **Durable rate limiting** — `src/lib/public-rate-limit.ts` and the assistant limiter are
  in-memory per serverless instance, so fleet-wide limits are effectively higher than configured.
  Back with Vercel KV / Upstash before heavy public traffic.
- [ ] **Upload validation by magic-bytes** — `document-upload.tsx` validates by filename extension;
  files land in a private, never-executed bucket (low risk) but content-sniffing would harden it.
- [ ] **`export-transcript` honeypot** — add the same honeypot the sibling public forms use
  (`src/app/api/assistant/export-transcript/route.ts`).
- [ ] **Verification result surfaced to member** — confirm verified/not-verified shows in
  `/account/requests`, not just status.
- [ ] **`admin-notify` superadmin inclusion** — confirm it no longer uses exact `=== 'admin'` (which
  excluded superadmins from notification email).

> **Already fixed — do NOT re-do (verified this pass):** name-change approval crash (`decide-request.ts`
> guards reviewer columns per table); member self-mutation of `cert_status`/name/`email`/`portal_role`/
> `account_status` (migration 036); request-table write bypass + message tampering S1/S2 (migration
> 029); contact-form → admin inbox (`/admin/inbox` reads `contact_messages`); navigator system prompts
> wired (`prompts.ts`); portal chrome/sidebar redesign (`components/portal/*`); header CTA → `/account`.
