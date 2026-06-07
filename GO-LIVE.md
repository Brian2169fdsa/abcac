# ABCAC Member Portal — Go-Live Checklist

Work top to bottom. Each phase is independent enough to verify on its own.

## 1. Database
- [ ] Apply migrations in order: `001_initial_schema.sql`, `002_admin_portal.sql`, `003_automations.sql`
  (`supabase db push`, or paste each into the SQL editor).
- [ ] Confirm RLS is **enabled** on every table (`select tablename, rowsecurity from pg_tables where schemaname='public';`).
- [ ] Confirm storage buckets exist: `member-documents`, `ceu-certificates`, `name-change-docs` (all **private**).

## 2. Auth & admin
- [ ] In Supabase Auth settings, enable email confirmations and set the site URL + redirect URLs to your domain.
- [ ] Create the first admin: sign up via `/`, confirm email, then
      `UPDATE public.profiles SET portal_role='admin' WHERE email='abcac@abcac.org';`
- [ ] Sign in at `/admin` and confirm the console loads; sign in as a normal member and confirm `/admin` rejects access.

## 3. Edge Functions
- [ ] Deploy: `admin-notify`, `create-checkout`, `stripe-webhook --no-verify-jwt`, `events --no-verify-jwt`, `scheduled-reminders --no-verify-jwt`.
- [ ] Set secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VERCEL_URL`.
- [ ] Create Vault secrets `edge_functions_url` and `service_role_key` (see `AUTOMATIONS.md`).

## 4. Payments  (see `PAYMENTS.md`)
- [ ] Register the Stripe webhook endpoint for `checkout.session.completed`.
- [ ] Test a payment with card `4242 4242 4242 4242`; confirm the invoice flips to **paid**.

## 5. Email automations  (see `AUTOMATIONS.md`)
- [ ] Verify welcome email on a test signup.
- [ ] Verify an admin alert fires on a test document upload.
- [ ] Manually invoke `scheduled-reminders` and confirm `{ "sent": N }`; confirm the `abcac-daily-reminders` cron job exists.

## 6. Frontend / hosting
- [ ] Point the custom domain (e.g. `portal.abcac.org`) at Vercel.
- [ ] Confirm security headers from `vercel.json` are served (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- [ ] Smoke-test each member page: profile save, document upload (try a >10MB and a `.exe` to confirm validation rejects them), CEU submit, apply, renewal, supervision, requests, messages, invoices, certificate/wallet-card download.

## 7. Data protection
- [ ] Decide handling for `ssn_last4` / `date_of_birth` (collected in plaintext under RLS) — confirm this is acceptable for your compliance needs.
- [ ] Enable Supabase Point-in-Time Recovery / backups.
- [ ] Confirm `.env` and `CLAUDE.md` are git-ignored (they are) and no real secrets are committed.

## Known follow-ups (post-launch nice-to-haves)
- Signup CAPTCHA / rate-limiting (Supabase Auth abuse protection).
- Admin pagination/filtering once member volume grows.
- Self-service email-change flow (currently admin-assisted).
