# ABCAC Member Portal

Member and staff portal for the **Arizona Board for Certification of Addiction
Counselors**. Members manage their profile, certifications, CEUs, documents,
renewals, and requests; staff review and act on everything from an admin console.

## Stack
- **Frontend:** static `index.html` (member portal) + `admin.html` (admin console), vanilla JS in `js/`
- **Backend:** [Supabase](https://supabase.com) — Postgres, Auth, Storage, Edge Functions
- **Payments:** Stripe Checkout (via Edge Functions)
- **Email:** Resend (via Edge Functions)
- **Hosting:** Vercel

## Layout
```
index.html                     Member portal (served at /)
admin.html                     Admin console (served at /admin)
js/portal.js                   Member portal logic
js/admin.js                    Admin console logic
supabase/migrations/           001 schema · 002 admin · 003 automations
supabase/functions/            admin-notify · create-checkout · stripe-webhook · events · scheduled-reminders
```

## Documentation
- [`ADMIN-PORTAL.md`](ADMIN-PORTAL.md) — admin console setup, first-admin promotion, security model
- [`PAYMENTS.md`](PAYMENTS.md) — Stripe setup
- [`AUTOMATIONS.md`](AUTOMATIONS.md) — email automations (triggers + scheduled reminders)
- [`GO-LIVE.md`](GO-LIVE.md) — pre-launch checklist
- [`ABCAC-MEMBER-PORTAL-BUILD.md`](ABCAC-MEMBER-PORTAL-BUILD.md) — original end-to-end build plan

## Security model (summary)
- Every table has Row-Level Security: members see only their own rows; admins
  (`profiles.portal_role = 'admin'`) get full access via `is_admin()`.
- All privileged secrets (service role, Stripe, Resend) live only in Edge
  Function secrets / Supabase Vault — never in the browser or committed code.
- Only the Supabase **anon** key is public, which is expected and safe behind RLS.

See [`GO-LIVE.md`](GO-LIVE.md) before launching.
