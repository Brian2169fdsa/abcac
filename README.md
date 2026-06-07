# ABCAC Member Portal

Member and staff portal for the **Arizona Board for Certification of Addiction
Counselors**. Members manage their profile, certifications, CEUs, documents,
renewals, applications, and requests; staff review and act on everything from a
native admin console.

## Stack
- **Frontend:** Next.js 14 (App Router) in `frontend/` — public website, member portal (`/account/*`), and admin console (`/admin/*`) in one app
- **Backend:** [Supabase](https://supabase.com) — Postgres, Auth, Storage, Edge Functions
- **Payments:** Stripe Checkout (via Next.js API route + legacy Edge Function)
- **Email:** Resend (via Edge Functions and `frontend/src/lib/email.ts`)
- **Hosting:** Vercel

## Features

**Member portal (`/account/*`)**
- Onboarding wizard, profile management
- Certification and renewal tracking; renewal invoices auto-created 30 days before expiry
- CEU submission and compliance status
- Document upload and fulfillment of admin document requests
- Application submission with attestation/e-signature
- Invoice payment via Stripe Checkout with receipt email
- Messaging thread with staff

**Admin console (`/admin/*`)**
- Dashboard with live counts and revenue
- Reports, Finance, and Compliance views
- Full audit log
- Account approval workflow (approve/reject pending member registrations)
- Applications, CEU, document, and request review queues
- Member management and messaging
- Invoice management; ability to request specific documents from a member

**Automations**
- Welcome email on signup; admin review alerts on document/CEU/application submission
- Admin alert when a new member submits their account for approval
- Daily renewal reminders (90/60/30 days before expiry) and CEU deadline alerts
- Auto-creation of $150 renewal invoices for certs expiring within 30 days (idempotent)
- Payment receipt emails to members on Stripe checkout completion

## Layout
```
frontend/                          Next.js app (root directory for Vercel)
  src/
    app/
      (admin)/admin/               Admin console
        page.tsx                   Dashboard
        reports/                   Reports
        finance/                   Finance
        compliance/                CEU compliance overview
        audit/                     Audit log
        approvals/                 Account approval queue
        applications/              Application review
        ceus/                      CEU review
        documents/                 Document review
        requests/                  Document requests to members
        members/                   Member management
        messaging/                 Messaging
        invoices/                  Invoice management
        search/                    Member search
      (portal)/account/            Member portal
        page.tsx                   Overview / dashboard
        onboarding/                Signup onboarding wizard
        profile/                   Profile management
        certifications/            Certifications
        ceus/                      CEU submissions
        documents/                 Document uploads
        requests/                  Fulfill admin document requests
        applications/              Applications
        apply/                     Submit a new application
        renew/                     Renewal flow
        renewals/                  Renewal history
        invoices/                  Invoices and payments
        messages/                  Member messaging
      api/
        stripe/webhook/            Next.js Stripe webhook (live payment handler)
        contact/                   Contact form (Resend)
    lib/
      ceu-compliance.ts            CEU compliance logic
      email.ts                     Server-only Resend helper (no-op when key absent)
      blog.ts                      Blog helpers
      catalog.ts                   Store catalog helpers
      stripe.ts                    Stripe helpers
      nav.ts                       Navigation config
      site-config.ts               Site-wide config
    middleware.ts                  Auth + admin role guard
  tests/                           Vitest unit tests
    blog.test.ts
    blog-extra.test.ts
    catalog.test.ts
    catalog-extra.test.ts
    ceu-compliance.test.ts
    utils.test.ts

supabase/
  migrations/                      001–012 (see GO-LIVE-UNIFIED.md)
  functions/
    admin-notify/                  JWT-verified; admin console → member emails
    create-checkout/               Creates Stripe Checkout sessions
    stripe-webhook/                Legacy; marks invoices paid (idempotency guard)
    events/                        DB trigger handler (welcome, alerts, submission)
    scheduled-reminders/           Daily: reminders + auto renewal invoicing
```

## Documentation
- [`GO-LIVE-UNIFIED.md`](GO-LIVE-UNIFIED.md) — full pre-launch runbook (migrations, env vars, smoke tests)
- [`AUTOMATIONS.md`](AUTOMATIONS.md) — email automations and scheduled jobs
- [`ADMIN-PORTAL.md`](ADMIN-PORTAL.md) — admin console setup and security model
- [`PAYMENTS.md`](PAYMENTS.md) — Stripe setup
- [`TODO.md`](TODO.md) — backlog and open security items

## Quick start (local)
```bash
cd frontend
cp .env.example .env.local   # fill in your Supabase + Stripe keys
npm install
npm run dev
```

## Testing
```bash
cd frontend && npm test
```

## Security model (summary)
- Every table has Row-Level Security: members see only their own rows; admins
  (`profiles.portal_role = 'admin'`) get full access via `is_admin()`.
- A `BEFORE UPDATE` trigger (`guard_profile_update`, migration 009) blocks members
  from self-promoting their role, self-approving their account, or setting their
  own Stripe customer id.
- All privileged secrets (service role, Stripe, Resend) live only in Edge
  Function secrets / Supabase Vault — never in the browser or committed code.
- Only the Supabase **anon** key is public, which is expected and safe behind RLS.

See [`GO-LIVE-UNIFIED.md`](GO-LIVE-UNIFIED.md) before launching.
