# ABCAC

Unified platform for the **Arizona Board for Certification of Addiction Counselors** —
one Next.js 14 (App Router) app serving the public website, the member portal
(`/account/*`), the admin console (`/admin/*`), and the AI Navigator assistants,
backed by a single Supabase project and Stripe.

## Source of truth

**See [`docs/LAUNCH-ASSESSMENT.md`](docs/LAUNCH-ASSESSMENT.md)** — the current status
document for the shipped platform. Operational guides live at the repo root:
[`SETUP-RUNBOOK.md`](SETUP-RUNBOOK.md) (go-live configuration) and
[`AUTOMATION-RUNBOOK.md`](AUTOMATION-RUNBOOK.md) (automation operations).
Historical planning documents (MASTER-PLAN, ASSESSMENT, EXECUTION-PLAN,
PORTAL-PARITY, SHIP-PLAN) are archived in [`docs/archive/`](docs/archive/).

## Quick start (local)

```bash
cp .env.example .env.local   # fill in Supabase + Stripe (+ optional Resend / Anthropic) keys
npm install
npm run dev
```

```bash
npm run build   # production build
npm test        # vitest unit tests
```

The schema lives in `supabase/migrations/001..041` (the source of truth for the database).
