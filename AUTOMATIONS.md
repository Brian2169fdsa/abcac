# ABCAC Email Automations — Setup

Email automations are implemented as **Supabase Edge Functions** (not n8n),
driven by database triggers and a daily scheduled job.

## What's automated

| Trigger | Function | Email |
|---|---|---|
| Member signs up (`profiles` INSERT) | `events` | Welcome email to the member |
| Document uploaded | `events` | "needs review" alert to admins |
| CEU submitted | `events` | "needs review" alert to admins |
| Name change / verification / reciprocity request | `events` | Alert to admins |
| Admin approves/rejects/changes status, messages, or invoices | `admin-notify` | Member notification *(already wired in the admin console)* |
| Daily, 90/60/30 days before expiry | `scheduled-reminders` | Renewal reminder to member |
| Daily, behind on CEUs within 60 days | `scheduled-reminders` | CEU deadline alert to member |

Member notifications on admin actions are sent directly by the admin console via
the `admin-notify` function (Phase 1) — no extra wiring needed.

## Setup

### 1. Deploy the functions
```bash
supabase functions deploy events             --no-verify-jwt
supabase functions deploy scheduled-reminders --no-verify-jwt
supabase functions deploy admin-notify        # JWT-verified (admin calls it)
```

### 2. Set shared secrets
```bash
supabase secrets set \
  RESEND_API_KEY=re_... \
  RESEND_FROM_EMAIL=noreply@abcac.org \
  ADMIN_EMAIL=abcac@abcac.org \
  VERCEL_URL=https://portal.abcac.org
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected into Edge Functions automatically.)

### 3. Create the Vault secrets used by triggers + cron
Replace placeholders with your real values:
```sql
select vault.create_secret('https://<project-ref>.functions.supabase.co', 'edge_functions_url');
select vault.create_secret('<your-service-role-key>',                      'service_role_key');
```

### 4. Apply the migration
```bash
supabase db push   # applies 003_automations.sql (triggers + daily cron)
```

## Graceful degradation
Every function no-ops cleanly if `RESEND_API_KEY` is unset, and the trigger
function does nothing until the Vault secrets exist — so the portal works fully
before email is switched on.

## Verifying
- **Welcome / alerts:** insert a test row (e.g. upload a document) and check the
  function logs (`supabase functions logs events`).
- **Reminders:** invoke manually —
  `curl -X POST https://<ref>.functions.supabase.co/scheduled-reminders -H "Authorization: Bearer <service-role-key>"`
  — and confirm the returned `{ "sent": N }`.
- **Cron:** `select * from cron.job;` should list `abcac-daily-reminders`.

## Security
All secrets (Resend, service role) live as Edge Function secrets or in Vault —
never in committed code or the browser. Trigger and cron HTTP calls authenticate
with the service-role key read from Vault at runtime.
