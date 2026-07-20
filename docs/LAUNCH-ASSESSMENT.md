# ABCAC Launch Assessment — Full Site, Portal, and Admin Audit

> 2026-07-19, updated 2026-07-20. Three parallel code audits (public site, member portal, admin
> console + config) plus live-production probes.
> **Status update 2026-07-20: every code item below (P0, P1, and P2) is fixed and merged (PR #163),
> and the live DB has migrations 040–042 + the cert_schedules seed applied.** The platform also now
> includes the legacy-member import/invite system (`docs/LEGACY-IMPORT-RUNBOOK.md`) and optional
> ClickUp task mirroring. What remains before launch is the owner/config table below plus the
> member-data import — no outstanding code work.
>
> Original verdict (2026-07-19): the platform is functionally complete. Every member flow has a
> real, permission-legal write path; every admin queue reads data a real flow writes; no mock data
> renders with current settings; missing env keys degrade safely.

## P0 — fix before launch (code)

1. **Fee payments aren't linked to applications.** The pay-at-the-end fee for initial packets and
   renewals writes `payments`/`payment_submissions` with no reference to the `applications` row, the
   webhook only advances `cert_sync` applications on payment, and the admin applications list/detail
   show no fee-paid indicator. Fix: pass the application id through the payments deep-link →
   checkout metadata → webhook advance + link; render a "Fee paid" badge in admin applications.
2. **Portal "Renew" buttons dead-end on a login wall.** Dashboard credential cards
   (`account/page.tsx:566`) and `renewals/page.tsx:208` link to the public `/store/...` page, which
   shows an authenticated member "Sign In to Pay." Fix: point at
   `/account/payments?product=certification-renewal-2-year-credential-renewal-fee`.
3. **Site PDF downloads still point at the old Duda CDN** (`irp.cdn-website.com`) on
   `initial-certification` (7 links) and `certification-renewal` (5 links) even though every file
   exists in `public/forms/library/`. Fix: repoint to local paths.
4. **`cert_schedules` is empty on the live DB** — the CEU tracker and renewal due-date engine are
   inert. Fix: seed the 7 credential rows (SQL below; refine numbers later if any credential
   differs from the 24-month / 40-hour / 3 Ethics / 3 Cultural Diversity default).

```sql
insert into public.cert_schedules (credential_type)
values ('CAC'),('CADAC'),('AADC'),('CCS'),('CCJP'),('CPRS'),('CPS')
on conflict (credential_type) do nothing;
```

## P1 — consistency (code, same pass)

5. **Two parallel recertification flows.** `/account/renew` (legacy free-text form) coexists with the
   digital recert packets; the site and dashboard link both; free-text renewals render poorly in the
   admin queue; the admin renewals pipeline reads `invoices` only, so self-serve renewal payments
   never advance it. Fix: retire `/account/renew` (redirect to the Certification hub), repoint all
   links, reconcile renewal-fee payments into the admin renewals view.
6. Dashboard sync links go to the public sales page instead of `/account/certification-sync`.
7. Signup (and login's "Create an account" link) drop the `next` parameter, losing pay-intent from
   Sign-In-to-Pay.
8. Sidebar dedupe: two entries → `/account/certifications`, three → `/account/requests`, two →
   `/account/experience` ("Authorizations" label misleading — that page never shows
   `supervision_authorizations`); `/account/applications` and `/account/renewals` unreachable from
   the nav. Fix: one entry per destination + section anchors; add Application Status + Renewals.
9. Notification preferences editable in two places (Profile + Settings) with no sync — keep Settings.
10. Copy: "Book an Audit" header CTA is template placeholder; CADAC missing from the homepage
    credential teaser; "1,000+" vs "1,200+" stat mismatch; sitemap missing certification-sync /
    directory / verify / board-application.
11. Cleanup: stale `docs/PAYMENT-SYSTEM-AUDIT.md` (describes the removed preview gate); legacy
    `supabase/functions/stripe-webhook` + `create-checkout` (double-processing risk if ever
    subscribed) — delete from the repo and the Supabase dashboard.

## P2 — polish (post-launch fine)

Robots additions (`/checkout/*`, `/auth/`, `/logout`); testing page "Invalid Date" on unsubmitted
requests; wide tables on phones (card layout at small breakpoints); decorative hero circle causes
slight horizontal scroll on mobile `/testing`; blog title naming; footer "Our services" heading;
"Store" duplicated in desktop nav; type the supervision joins.

## Not done — owner/config (only you can do these)

| # | Item | Impact today |
|---|------|--------------|
| A | **Resend email** (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, verify abcac.org domain) | ALL email is a silent no-op: receipts, approval notices, signer invitations, reminders |
| B | **Confirm Admin → Finance shows the $25 test payment** | Verifies webhook → dashboard chain; still unconfirmed |
| C | **Live Stripe**: `npm run seed:stripe` with live key, commit live price map, swap Vercel keys | Site can only take test-card payments |
| D | `ANTHROPIC_API_KEY` in Vercel | "Need help?" chat widgets return a friendly 503 |
| E | `CRON_SECRET` in Vercel (+ cron config) | Renewal reminders and automation digest never run |
| F | AZBBHE logo → `public/brand/azbbhe-logo.png` | Testing page board section shows no logo |
| G | **DNS cutover** abcac.org → Vercel | Real visitors still see the old Duda site |
| H | Automation rollout decision (16 workflows shipped OFF — see `docs/ship/03`) | Manual ops only (safe default) |
| I | Optional: delete test rows (E2E payment/submissions, `brian+abcac-e2e-test` account) | Cosmetic |

## The plan (updated 2026-07-20)

- ~~**Phase 1 — code fix pass:** all P0/P1 code items~~ ✅ done, merged.
- ~~**Phase 2 — SQL:** `cert_schedules` seed + `legacy_members` table~~ ✅ run on live 2026-07-20.
- **Phase 3 — member data (next):** import the historical member export and run the invite
  campaign — see `docs/LEGACY-IMPORT-RUNBOOK.md`. Needs the export file + service-role key.
- **Phase 4 — config afternoon (owner, ~30 min):** A → F in the table. Resend first (email is the
  biggest silent gap — and required before invites go out), then the Finance check, ClickUp
  token/List ID, live Stripe when ready for real money.
- **Phase 5 — launch:** DNS cutover, then the smoke test in `docs/ship/04-launch-readiness.md`
  (signup → apply → pay → approve → certificate).
- **Phase 6 — post-launch:** automation phased enablement, test-data cleanup, anything real
  members surface in the first weeks.
