# ABCAC

Unified platform for the **Arizona Board for Certification of Addiction Counselors** —
one Next.js 14 (App Router) app serving the public website, the member portal
(`/account/*`), the admin console (`/admin/*`), and the AI Navigator assistants,
backed by a single Supabase project and Stripe.

## Source of truth

**See [`MASTER-PLAN.md`](MASTER-PLAN.md)** — the single control document for this project.
It covers the overview, current build state, the AI Navigator system, the prioritized
backlog, manual owner steps, the multi-agent execution plan, and key decisions +
schema pointer. All prior planning/assessment/status docs have been consolidated into it.

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

The schema lives in `supabase/migrations/001..024` (the source of truth for the database).
