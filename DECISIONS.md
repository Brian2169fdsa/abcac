# DECISIONS.md

Running log of decisions and constraints observed for the ABCAC Member Portal + Admin Panel. Created during Phase 0 audit (read-only). Entries cite files so they stay verifiable.

---

## Phase 0 audit — 2026-06-07

### (a) Environment constraints (build container)
- **No live Supabase / Stripe / Resend / n8n access from the build container.** Verified by `.env.example`: `SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `RESEND_API_KEY=` (empty). The public anon key + URL for project `ajgqqfggdctmcqhbmptb` are present but are read-only / RLS-bound.
- **Migrations are a manual owner step** — applied via Supabase SQL editor or `supabase db push` (see GO-LIVE-UNIFIED.md §1). Migrations `001..013` are in `supabase/migrations/`.
- **First-admin promotion is manual SQL** (002 / GO-LIVE-UNIFIED): `update public.profiles set portal_role='admin', account_status='approved' where email='abcac@abcac.org';`.
- **Stripe price map seeding is manual** — `src/data/stripe-price-map.json` is currently `{}`; `scripts/seed-stripe.ts` must be run with a Stripe key to populate it, otherwise `/api/stripe/checkout` returns `503 price_not_found`.
- **Spreadsheet / member import is a manual owner step** (no importer in the repo; member directory is populated via signup + admin).
- **Edge Functions + pg_cron + Vault secrets are deployed manually** (`events`, `scheduled-reminders`, `admin-notify`, `create-checkout`, legacy `stripe-webhook`) per GO-LIVE-UNIFIED §4. Vault secrets `edge_functions_url` + `service_role_key` gate the DB notify triggers; everything no-ops gracefully when unset.
- Code must NOT be modified in Phase 0; this phase only adds documentation (`SCHEMA-CURRENT.md`, `GAP-ANALYSIS.md`, `DECISIONS.md`). `npm run build` is run once to confirm the tree still builds.

### (b) Native vs redirect — Apply / Renewal
- **Apply for Certification and Renewal are NATIVE in-portal forms**, not redirects to the public store. `src/app/(portal)/account/apply/page.tsx` and `account/renew/page.tsx` both render `MemberApplicationForm` (`src/components/member-application-form.tsx`), which writes `applications` + uploads to `member-documents` storage + (renewal) inserts a `ceu_records` summary row.
- **Payment is decoupled from the application.** The fee is a separate Stripe store purchase (`/initial-certification`, `/store/[slug]`, `/store/certification-renewal-2-year-credential-renewal-fee`). Decision evident in `src/app/api/stripe/webhook/route.ts`: paying a fee never auto-grants/renews a credential — the **only** automatic credential effect of payment is enabling Certification Sync (`sync_enabled=true` for `slug==='certification-sync'`). Credentials are issued by ABCAC staff in `/admin/members` (`issue-cert-form.tsx`) after review.
- **Certification Sync** is a $15/mo Stripe subscription (`/store/certification-sync`); managed via the Stripe billing portal (`/api/stripe/portal`). It sets a boolean flag, not a date-reconciliation engine.

### (c) Email provider — Resend
- **Resend is the email provider.** Direct REST calls to `https://api.resend.com/emails` from `src/lib/email.ts` (used by the Stripe webhook receipt), `src/app/api/contact/route.ts`, `src/app/api/board-application/route.ts`, and both Edge Functions (`supabase/functions/events`, `supabase/functions/scheduled-reminders`). From address defaults to `noreply@abcac.org` (`RESEND_FROM_EMAIL`).
- **Graceful degradation**: when `RESEND_API_KEY` is unset, email helpers no-op; `/api/contact` and `/api/board-application` fall back to inserting into `contact_messages` (service role).

### (d) Schema-name decisions observed
- **No separate `members` table.** `member_id` everywhere equals `profiles.id` which equals the Supabase `auth.users.id` (`auth.uid()`). Confirmed in `lib/supabase/server.ts` usage and `api/stripe/checkout/route.ts` comments.
- **`certifications` = system of record for ISSUED credentials; `other_certifications` = member-recorded EXTERNAL credentials.** Migration 013 made `certifications` member-read-only (SELECT) while leaving `other_certifications` member-writable. `applications.member_notes` (005) holds the applicant's own notes; `admin_notes` is reserved for staff.
- **`supervision_records` is keyed on `supervisor_id`**, not `member_id` (RLS `auth.uid()=supervisor_id`).
- **`verification_requests` uses `completed_at`** (no `reviewed_at`); other request tables use `reviewed_at` — `request-review-actions.tsx` branches on the table name to stamp the right column.
- **`messages` are admin→member only** (RLS hardened in 009: members SELECT + UPDATE-is_read only; no member INSERT; no thread/parent column).
- **`account_status` defaults to `'approved'`** at the column level (007) to avoid locking out existing members; only `handle_new_user` sets new signups to `'pending'`.
- **`payments.member_id` is `ON DELETE SET NULL`** (guest checkout allowed); `payments.stripe_event_id` is `UNIQUE` (webhook idempotency).
- **No `cert_schedules` table / due-dates engine** — renewal timing is derived from `certifications.expiration_date` at read time and in `scheduled-reminders`.

### (e) Automation stack decision — Edge Functions over n8n
- The implemented automation layer is **Supabase Edge Functions + pg_cron + Resend**, not n8n. The build brief (`ABCAC-MEMBER-PORTAL-BUILD.md`) references n8n Cloud, but the repo contains no n8n workflow JSON; `supabase/functions/scheduled-reminders` is the renewal-alerts implementation. Treat n8n `ABCAC-01-RENEWAL-ALERTS` as superseded unless the owner specifically requires the n8n artifact.

---

## Signup cert numbers + approval credentials email — 2026-06-07

### (f) Self-reported certification numbers at signup
- **Members cannot insert into `public.certifications`** (migration 013 made it member-read-only — it is the system of record for ISSUED credentials, written only by ABCAC staff / the service role). So at signup, cert holders (`cert_status` `active_holder` / `reciprocity_transfer`) self-report their existing number(s) via a dynamic field on `/signup`. The numbers are passed through `supabase.auth.signUp({ options: { data: { cert_numbers } } })` as a single compact TEXT string (e.g. `"12345 (AAC), 67890"`) — raw metadata the anon user is allowed to set on themselves.
- **Migration `021_signup_cert_numbers.sql` (additive)**: adds nullable `profiles.submitted_cert_numbers TEXT` and re-creates `handle_new_user` (based on the 007 version) to also copy `raw_user_meta_data->>'cert_numbers'` into it. All prior trigger behavior is preserved (profile from metadata, `account_status='pending'`, notification prefs). Additive-only; must be applied manually (Supabase SQL editor / `supabase db push`) like all migrations.
- `/admin/approvals` surfaces `submitted_cert_numbers` (already returned by `select("*")`) next to the existing `certifications` join, so an admin can verify the self-reported numbers before approving. Approve/reject unchanged.

### (g) Approval credentials email — we email the username (email) + login link, NOT a password
- **We CANNOT email a plaintext password.** Supabase stores credentials hashed (bcrypt) and never exposes them; there is no plaintext to send. **Decision:** on approval we email the member that (a) their **username is their email**, (b) a portal **login link** (`NEXT_PUBLIC_SITE_URL` + `/login`, falling back to `http://localhost:3000` to match the rest of the app), and (c) an instruction to sign in with the password they chose at signup, with a forgot-password path back to the sign-in page. All interpolated values are HTML-escaped.
- **Implementation:** new admin-gated server action `src/app/(admin)/admin/approvals/approve-account.ts` (`sendApprovalCredentialsEmail`), mirroring `decide-verification.ts`: re-checks `portal_role='admin'` on the cookie-bound session, fetches the member's email **server-side** via the service role (authoritative username, not client-supplied), then sends inline via Resend. **Graceful no-op without `RESEND_API_KEY`** — returns `{ ok: true }` without sending, so `npm run build` passes with no env vars. The existing `admin-notify` Edge Function call is kept as a best-effort secondary path; the inline email does not depend on it.
