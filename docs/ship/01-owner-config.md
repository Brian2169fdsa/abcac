# 01 — Owner / Config Checklist (no code required)

These are the steps only the owner can do (credentials, DNS, deploy). The app **degrades gracefully**
until each is done — nothing crashes, but the corresponding feature is inert. Do these in order; most
are same-day once you have the accounts.

Legend: 🔴 = hard launch blocker · 🟠 = required for that feature to work · 🟢 = recommended.

---

## A. Payments — Stripe 🔴

Without this, **100% of checkouts return 503** (`src/data/stripe-price-map.json` is currently `{}`).

- [ ] 🔴 Create/confirm the live Stripe account; get `STRIPE_SECRET_KEY` (`sk_live_…`) and
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
- [ ] 🔴 Run the seeder against live Stripe and commit the result:
  ```bash
  STRIPE_SECRET_KEY=sk_live_... npm run seed:stripe
  # writes src/data/stripe-price-map.json — commit & deploy it
  ```
  Verify every catalog slug gets a price ID — **especially** `icrc-reciprocity-transfer`,
  `certification-sync`, and the renewal-fee slug.
- [ ] 🔴 Register the webhook endpoint in Stripe → `https://<domain>/api/stripe/webhook`
  for `checkout.session.completed` and `invoice.paid`. Put the signing secret in
  `STRIPE_WEBHOOK_SECRET`.
- [ ] 🟠 **Confirm the Next.js route is the registered endpoint**, not the legacy Supabase
  `stripe-webhook` Edge Function (which is invoice-only and does not write `payments`). Retire or
  disable the Edge one to avoid a split-brain. *(This was flagged in every prior audit — verify it.)*

## B. Email — Resend 🟠

Without a key + verified domain, **all transactional email silently no-ops** (approvals, receipts,
reminders, request decisions, digests).

- [ ] 🟠 `RESEND_API_KEY` set in Vercel.
- [ ] 🟠 `RESEND_FROM_EMAIL` set (e.g. `no-reply@abcac.org`).
- [ ] 🟠 Verify the **`abcac.org` sending domain** in Resend (SPF/DKIM DNS records).

## C. AI navigators — Anthropic 🟠

- [ ] 🟠 `ANTHROPIC_API_KEY` set. Without it, `/api/assistant` returns 503 and the chat widgets
  degrade gracefully. This key also powers automation document-vision.

## D. Environment variables (Vercel + local `.env.local`) 🔴

- [ ] 🔴 `NEXT_PUBLIC_SITE_URL`
- [ ] 🔴 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 🔴 `SUPABASE_SERVICE_ROLE_KEY` (server-only — powers admin writes + automation)
- [ ] 🔴 Stripe keys (A) + `STRIPE_WEBHOOK_SECRET`
- [ ] 🟠 Resend keys (B), `ANTHROPIC_API_KEY` (C)
- [ ] 🟠 `CRON_SECRET` — the `/api/cron/*` routes fail-closed (503) until set. Configure the same
  bearer token in the Vercel cron config so the scheduled reminders + automation digest can run.
- [ ] 🟢 Confirm no secret is exposed under a `NEXT_PUBLIC_` name.

## E. Database — Supabase 🔴

One project, ref `ajgqqfggdctmcqhbmptb`. Migrations are the source of truth.

- [ ] 🔴 Apply **all migrations through `036`** in order (`supabase db push` or SQL editor).
  Prior audits confirmed the live DB was migrated through 036; **re-verify** the live schema matches
  `supabase/migrations/` before launch. Numbering skips 019/020 (expected — no such files).
- [ ] 🟠 **Import the cert schedules** (per-credential renewal/CEU rules):
  ```bash
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:cert-schedules
  ```
  Confirm CAC/CADAC/AADC/CCS/CCJP/CPRS/CPS rows against the real due-dates spreadsheet
  (`data/cert-schedules.sample.csv` is only a sample).
- [ ] 🔴 **Promote the admin login** after they sign up + confirm email:
  ```sql
  update public.profiles
    set portal_role='admin', account_status='approved'
    where email='<admin@abcac.org>';
  ```
- [ ] 🟢 **Seed a second (reserve) superadmin** so there is no single point of failure
  (`portal_role='superadmin'`). Document service-role recovery.

## F. Edge Functions + scheduled automation 🟠

- [ ] 🟠 Deploy `admin-notify`, `events`, `scheduled-reminders` (the deployed reminder engine).
- [ ] 🟠 Create Vault secrets `edge_functions_url` + `service_role_key` (gate the DB notify triggers).
- [ ] 🟠 Confirm the `abcac-daily-reminders` pg_cron job (created by migration 003) is present.
- [ ] 🟢 **Do not** also run the optional n8n `ABCAC-01-RENEWAL-ALERTS` workflow — run one reminder
  path, not both (double-send risk). Prefer the Edge Function / Vercel cron.

## G. Supabase Auth config 🔴

- [ ] 🔴 Site URL = production domain.
- [ ] 🔴 Add `/auth/callback` redirect URLs (prod + Vercel preview + `http://localhost:3000`).
- [ ] 🔴 Enable email confirmations.

## H. Domain cutover 🟠

- [ ] 🟠 `abcac.org` currently points at the **old Duda site**. Cut over to the Vercel app when
  launch-ready. Until then, test on `abcac.vercel.app`.

---

### Owner config: definition of done
All 🔴 checked, a live test checkout succeeds end-to-end (checkout → webhook → `payments` row →
receipt email), the admin can log in and see real queues, and a reminder email actually sends.
See [`04-launch-readiness.md`](04-launch-readiness.md).
