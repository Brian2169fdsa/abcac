# ABCAC — Go-Live Runbook (Unified App)

One Next.js app (`frontend/`) serves the **public website**, the **member
portal** (`/account/*`), and the **admin console** (`/admin/*`), all backed by
one Supabase project (`ajgqqfggdctmcqhbmptb`) and Stripe. Work top to bottom.

---

## 1. Supabase — database
Apply migrations in order (SQL editor or `supabase db push`):
`001` schema · `002` admin/RLS/buckets · `003` automations · `004` website
integration · `005` portal enhancements · `006` signup profile · `007` account
approval · `008` admin submission alert.

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
  - `RESEND_API_KEY` (optional), `NEXT_PUBLIC_PORTAL_URL=/account`
- [ ] Merge PR #4 to `main` (production builds from `main`).

## 4. Edge Functions
Deploy (run from `supabase/`):
```bash
supabase functions deploy admin-notify
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook       --no-verify-jwt
supabase functions deploy events               --no-verify-jwt
supabase functions deploy scheduled-reminders  --no-verify-jwt
```
Set secrets:
```bash
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL=noreply@abcac.org \
  ADMIN_EMAIL=abcac@abcac.org VERCEL_URL=https://portal.abcac.org \
  STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
```
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
6. **Pay** an invoice / store item with test card `4242 4242 4242 4242` → `payments` row written; invoice flips to paid.
7. Admin `/admin` dashboard shows live counts + revenue.

## 7. Cleanup (optional, after verifying)
- [ ] Retire the static `/portal` + `/portal/admin` (`frontend/public/portal/`,
      root `index.html`/`admin.html`) — superseded by the native app (see TODO.md).

---

### Graceful degradation
Everything degrades safely if a secret is missing: payments show "not enabled,"
emails no-op, and the portal still works — so you can apply migrations and go
live incrementally without breaking the app.
