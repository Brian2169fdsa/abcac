# ABCAC — Go-Live Runbook (Unified App)

One Next.js app (`frontend/`) serves the **public website**, the **member
portal** (`/account/*`), and the **admin console** (`/admin/*`), all backed by
one Supabase project (`ajgqqfggdctmcqhbmptb`) and Stripe. Work top to bottom.

---

## 1. Supabase — database
Apply migrations in order (SQL editor or `supabase db push`):

| Migration | What it adds |
|-----------|-------------|
| `001_initial_schema` | Core tables: profiles, certifications, ceu_records, documents, invoices, applications, requests, notification_preferences |
| `002_admin_portal` | `is_admin()` helper, admin-wide RLS policies, audit log, storage buckets (`member-documents`, `ceu-certificates`, `name-change-docs`) |
| `003_automations` | pg_cron + pg_net extensions, `notify_events()` trigger helper, daily reminder cron job wired to `scheduled-reminders` |
| `004_website_integration` | `payments` table (Stripe idempotency via `stripe_event_id`), contact_submissions, store/commerce flows |
| `005_portal_enhancements` | Application attestation/e-signature columns, member notes, status-change notification triggers |
| `006_signup_profile` | Populates profile from auth metadata (first_name, last_name, phone) on signup |
| `007_account_approval` | `account_status` column (pending/approved/rejected), new-signup starts as `pending` |
| `008_admin_submission_alert` | Trigger fires `notify_events()` → `events` function when member submits registration for approval |
| `009_rls_hardening` | `guard_profile_update()` BEFORE trigger blocks privilege-escalation (members cannot self-promote role or self-approve account) |
| `010_document_requests` | `document_requests` table — admins request specific documents from members; members fulfill via portal |
| `011_stripe_customer` | Adds `stripe_customer_id` to profiles; extends guard to prevent members from modifying it |
| `012_notify_payload_trim` | Rewrites `notify_events()` to strip PII (ssn_last4, date_of_birth) from profiles payloads sent to Edge Functions |

- [ ] Confirm RLS is ON for every public table.
- [ ] Confirm storage buckets exist (created by `002`): `member-documents`,
      `ceu-certificates`, `name-change-docs` — all **private**.
- [ ] Promote your first admin (after that person signs up + confirms email):
      ```sql
      update public.profiles set portal_role='admin', account_status='approved'
      where email='abcac@abcac.org';
      ```

## 2. Supabase — auth
- [ ] Authentication → Providers → Email: enable email + confirmations.
- [ ] Authentication → URL Configuration:
  - **Site URL** = your production domain (e.g. `https://portal.abcac.org`).
  - **Redirect URLs** — add `https://YOURDOMAIN/auth/callback` (and the Vercel
    preview URL + `http://localhost:3000/auth/callback` for testing). Required
    for signup confirmation and password-reset links.

## 3. Vercel — make the app primary
- [ ] Project → Settings → General → **Root Directory = `frontend`**.
- [ ] Project → Settings → Environment Variables (from `frontend/.env.example`):
  - `NEXT_PUBLIC_SITE_URL` = production URL
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (optional — receipt emails + contact form fall back gracefully when unset)
  - `NEXT_PUBLIC_PORTAL_URL=/account`
- [ ] Merge PR #4 to `main` (production builds from `main`).

## 4. Edge Functions
Deploy (run from `supabase/`):
```bash
supabase functions deploy admin-notify                          # JWT-verified; admin console calls it
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook       --no-verify-jwt  # legacy; see note in §5
supabase functions deploy events               --no-verify-jwt  # DB triggers + account-submission alerts
supabase functions deploy scheduled-reminders  --no-verify-jwt  # daily reminders + auto renewal invoicing
```
Set secrets:
```bash
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL=noreply@abcac.org \
  ADMIN_EMAIL=abcac@abcac.org VERCEL_URL=https://portal.abcac.org \
  STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
```

**What the functions do:**
- `admin-notify` — sends member notification emails when an admin acts (approves/rejects a CEU, document, application, etc.); verifies the caller is a signed-in admin before sending.
- `create-checkout` — creates a Stripe Checkout session for portal payments.
- `stripe-webhook` — legacy Edge Function; marks invoices paid on `checkout.session.completed` with an idempotency guard on `stripe_event_id`.
- `events` — handles DB trigger payloads: welcome email on signup, admin review alerts on document/CEU/application INSERT, and account-submission alerts on profile UPDATE.
- `scheduled-reminders` — runs daily via pg_cron: sends renewal reminders at 90/60/30 days before expiry, CEU deadline alerts within 60 days, and auto-creates a $150 unpaid renewal invoice for certifications expiring within 30 days (idempotent — skips if an unpaid renewal invoice already exists in the past 60 days).
Create Vault secrets used by DB triggers + the daily cron:
```sql
select vault.create_secret('https://ajgqqfggdctmcqhbmptb.functions.supabase.co', 'edge_functions_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

## 5. Stripe
- [ ] Seed products/prices (writes `src/data/stripe-price-map.json`):
      ```bash
      cd frontend && STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/seed-stripe.ts
      ```
      Commit the updated price map (or re-run in each environment).
- [ ] Stripe Dashboard → Webhooks → add endpoint
      `https://YOURDOMAIN/api/stripe/webhook` for events
      `checkout.session.completed` and `invoice.paid`; put its signing secret in
      `STRIPE_WEBHOOK_SECRET` (both Vercel and the Edge Function secrets).
- [ ] Note: the **Next.js** webhook (`/api/stripe/webhook`) is the live one for
      the unified app. The Supabase `stripe-webhook` function is legacy — point
      Stripe at the Next.js route.

## 6. Smoke test (end-to-end)
1. **Register** at `/signup` → confirm email → sign in → land on `/account/onboarding`.
2. Submit info + certifications → admin gets the "new account awaiting approval" email.
3. **Admin** `/admin/approvals` → Approve → member gets approval email + full portal access; their certs activate.
4. Member **applies** (`/account/apply`) with attestation + signature → admin `/admin/applications` sets status → member is emailed + sees the status timeline.
5. **Upload a document** → admin `/admin/documents` approve/reject → member emailed; checklist updates.
6. Admin `/admin/requests` → Request a specific document from a member → member sees and fulfills it at `/account/requests`.
7. **Pay** an invoice / store item with test card `4242 4242 4242 4242` → `payments` row written; invoice flips to paid; member receives a payment receipt email.
8. Admin `/admin` dashboard shows live counts + revenue; `/admin/reports`, `/admin/finance`, `/admin/compliance`, and `/admin/audit` load correctly.
9. **CEU compliance:** member submits a CEU at `/account/ceus`; admin `/admin/ceus` approves/rejects; admin `/admin/compliance` shows CEU status by member.
10. Trigger `scheduled-reminders` manually → confirm renewal reminder emails and that a $150 renewal invoice is created for any cert expiring within 30 days.

## 7. Cleanup (optional, after verifying)
- [ ] Retire the static `/portal` + `/portal/admin` (`frontend/public/portal/`,
      root `index.html`/`admin.html`) — superseded by the native app (see TODO.md).

---

### Graceful degradation
Everything degrades safely if a secret is missing: payments show "not enabled,"
emails no-op, and the portal still works — so you can apply migrations and go
live incrementally without breaking the app.
