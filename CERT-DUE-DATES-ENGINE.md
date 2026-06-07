# CERT DUE-DATES ENGINE + ABCAC-01-RENEWAL-ALERTS

This document describes the cert due-dates engine added for ABCAC: the
`cert_schedules` reference table, the pure-TS due-date helpers, the idempotent
spreadsheet importer, and the importable n8n renewal-alerts workflow.

**Architecture principle:** Supabase is the single source of truth. A member's
actual renewal due date is computed from REAL db state
(`certifications.expiration_date`) plus the per-credential rules in
`cert_schedules`, gated by the member's alert opt-in
(`notification_preferences.renewal_reminders`). `cert_schedules` stores the
*rules* (cycle length, CEU requirements, grace window) — not per-member due
dates.

---

## 1. The `cert_schedules` table — migration `016_cert_schedules.sql`

Keyed by `credential_type` (one row per ABCAC credential):

| Column | Type | Default | Meaning |
|---|---|---|---|
| `id` | uuid | `uuid_generate_v4()` | PK |
| `credential_type` | text (unique) | — | CAC / CADAC / AADC / CCS / CCJP / CPRS / CPS |
| `renewal_cycle_months` | int | 24 | length of the renewal cycle |
| `ceu_total_required` | int | 40 | total CEU hours per cycle |
| `ceu_ethics_required` | int | 3 | of which Ethics |
| `ceu_cultural_required` | int | 3 | of which Cultural Diversity |
| `grace_period_days` | int | 0 | days past expiry before lapse |
| `notes` | text | null | free text |
| `created_at` | timestamptz | `now()` | |

Credential codes were cross-checked against
`src/app/(site)/initial-certification/page.tsx` (CAC, CADAC, AADC, CCS, CCJP,
CPRS, CPS). The migration seeds one row per credential with sensible defaults
(24-month cycle, 40/3/3 CEUs; CPRS uses a lower placeholder the owner should
confirm). Seeding uses `ON CONFLICT (credential_type) DO NOTHING`, so the
migration is safe to re-run and never clobbers values written by the importer.

**RLS:** any `authenticated` member may `SELECT` (reference data); only admins
(`public.is_admin()`) may write. The importer writes via the service-role key,
which bypasses RLS.

**Additive only.** `supabase/` is excluded from the Next typecheck/build
(`tsconfig.json` `exclude`), so this migration does not affect `npm run build`.

### Apply the migration

```bash
# via Supabase CLI (preferred)
supabase db push
# or paste supabase/migrations/016_cert_schedules.sql into the SQL editor
```

---

## 2. Due-date helpers — `src/lib/schedules.ts`

Pure, side-effect-free TypeScript (no DB calls), unit-tested in
`tests/schedules.test.ts`. Given a `CertSchedule` row plus a member date it
computes `nextDueDate`, `daysUntilDue`, a `tier`
(`90-day | 60-day | 30-day | 7-day | due | overdue | ok`), the `graceEndDate`,
and `inGracePeriod` / `lapsed` flags.

Exports:

- `computeDueFromExpiration(schedule, expirationDate, asOf?)` — when a stored
  `certifications.expiration_date` is known.
- `computeDueFromLastRenewal(schedule, lastRenewalDate, asOf?)` — projects
  forward by `renewal_cycle_months` when there is no stored expiration.
- Utilities: `addMonths`, `addDays`, `daysBetween`, `tierForDays`,
  `isExactReminderDay`, and `REMINDER_TIER_DAYS` (`[90, 60, 30, 7]`).

The tier thresholds intentionally mirror
`supabase/functions/scheduled-reminders/index.ts` and the n8n workflow so all
three agree on who is due.

---

## 3. Importer — `scripts/import-cert-schedules.ts`

Idempotent upsert of the cert-schedule spreadsheet into `cert_schedules`,
keyed on `credential_type`. Mirrors the style of `scripts/seed-stripe.ts`
(reads secrets from env by name, never hardcoded).

### Usage

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx scripts/import-cert-schedules.ts [path/to/cert-schedules.csv]

# or via the npm script:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:cert-schedules
```

CSV path resolution: first CLI arg → `CERT_SCHEDULES_CSV` env →
`data/cert-schedules.csv` → falls back to the shipped
`data/cert-schedules.sample.csv` (with a warning).

### Replacing the sample with the real spreadsheet

`data/cert-schedules.sample.csv` ships with a header row + the seeded defaults
so the importer is runnable today. **When the real export is available:**

1. Export the owner's schedule spreadsheet to CSV with the exact header:
   ```
   credential_type,renewal_cycle_months,ceu_total_required,ceu_ethics_required,ceu_cultural_required,grace_period_days,notes
   ```
2. Save it as `data/cert-schedules.csv` (this overrides the sample).
3. Run the importer (above). Re-running updates existing rows — safe and
   idempotent.

The script type-checks under `tsc --noEmit` (it is included via
`tsconfig.json` `include: scripts/**/*.ts`, like `seed-stripe.ts`) but is run
manually by the owner — it is not part of `npm run build`.

---

## 4. n8n workflow — `n8n/ABCAC-01-RENEWAL-ALERTS.json`

An importable n8n workflow (no secrets — all credentials/values are `$env`
placeholders). Node chain:

1. **Daily 7am MST** — Schedule Trigger (`0 7 * * *`, `America/Phoenix`).
2. **Query Renewal Candidates** — HTTP POST to a Supabase RPC/View that joins
   `certifications` + `profiles` + `cert_schedules` + approved CEU progress +
   `notification_preferences`.
3. **Split Out Rows** → **Compute Due Tier** (Code node mirroring
   `src/lib/schedules.ts`: keeps rows at exactly 90/60/30/7 days out and
   computes `ceuRemaining`).
4. **Opted Into Alerts** — Filter on `renewal_reminders !== false` (the
   alert-preference column from `SCHEMA-CURRENT.md` /
   `public.notification_preferences.renewal_reminders`).
5. **Send Renewal Email** — Resend HTTP send (swap for the SMTP/Send-Email node
   if preferred).
6. **On Error** (Error Trigger) → **Notify Ops Of Failure** — emails
   `ALERT_OPS_EMAIL` on any execution failure.

### Import steps

1. n8n → **Workflows** → **Import from File** → select
   `n8n/ABCAC-01-RENEWAL-ALERTS.json`.
2. Set environment variables / credentials in n8n:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or wire the SMTP node instead)
   - `PORTAL_URL` (e.g. `https://portal.abcac.org`)
   - `ALERT_OPS_EMAIL` (failure inbox)
3. Create the Supabase query backing **Query Renewal Candidates**. A view/RPC
   that returns one row per member-credential is recommended, e.g.:

   ```sql
   create or replace view public.cert_renewal_candidates as
   select
     c.member_id,
     p.email,
     p.first_name,
     c.cert_type,
     c.expiration_date,
     s.renewal_cycle_months,
     s.ceu_total_required,
     coalesce((
       select sum(r.hours) from public.ceu_records r
       where r.member_id = c.member_id and r.status = 'approved'
     ), 0) as ceu_total_approved,
     coalesce(np.renewal_reminders, true) as renewal_reminders
   from public.certifications c
   join public.profiles p on p.id = c.member_id
   left join public.cert_schedules s on s.credential_type = c.cert_type
   left join public.notification_preferences np on np.member_id = c.member_id
   where c.status = 'active' and c.expiration_date is not null;
   ```

   Expose it as an RPC, or point the HTTP node at
   `/rest/v1/cert_renewal_candidates` (GET) instead of the RPC POST.
4. Activate the workflow.

---

## 5. Relationship to `scheduled-reminders` (Edge Function)

`supabase/functions/scheduled-reminders/index.ts` already implements an
Edge-Function version of renewal reminders (runs daily via pg_cron; sends 90/60/30-day
reminders and CEU alerts honoring `notification_preferences`, and auto-creates
the $150 renewal invoice). **That is the in-DB implementation already deployed.**

`ABCAC-01-RENEWAL-ALERTS` is the build brief's requested n8n equivalent of the
renewal-reminder leg. The two are functionally overlapping — **run one, not
both**, or you will double-send:

- Keep the **Edge Function** if you want everything inside Supabase
  (recommended; it also handles invoice creation, which the n8n workflow does
  not).
- Use the **n8n workflow** if the brief/ops require n8n; then disable the
  pg_cron call to `scheduled-reminders` (or trim that function to invoice-only).

All three layers (Edge Function, `src/lib/schedules.ts`, n8n Code node) share
the same 90/60/30/7-day thresholds and the same opt-in gate so their results
agree.
