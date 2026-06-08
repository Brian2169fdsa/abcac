# ABCAC — Go-Live Setup Runbook

Everything in the codebase is built and deploys. These steps turn on the
features that are intentionally **dark until configured** (they degrade
gracefully — the app never crashes when a key is missing).

Do these in **Vercel → Project `abcac` → Settings → Environment Variables**
(set for **Production** and **Preview**), then redeploy. None of this requires
code changes.

---

## 0. Already wired (verify present, don't change)

The public site + portal already read/write Supabase, so these are almost
certainly set. Confirm they exist:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_URL` | Server-side (same URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required for admin writes** (cockpit actions, approvals, messaging). If admin actions work in prod, it's set. |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://abcac.org` — used in emails/links |

---

## 1. AI assistants + planning  →  `ANTHROPIC_API_KEY`

Powers the chat widget on all three surfaces (website / member / admin) and the
admin planning/drafting tools. Without it the widget returns `503`.

1. Get a key at **console.anthropic.com → API Keys**.
2. Vercel env var:
   - `ANTHROPIC_API_KEY = sk-ant-...`
3. Redeploy. Done — the model id (`claude-opus-4-8`) and settings are already in code.

> The key must live in **Vercel env vars**, not a local shell — the live site
> runs on Vercel, not your machine.

---

## 2. Payments  →  Stripe (3 vars + a one-time seed)

Without these, checkout/sync/invoice routes return `503`.

### 2a. Seed products & prices (one-time, run locally)
This creates a Stripe Product + Price for every catalog item and writes the
price ids into `src/data/stripe-price-map.json`.

```bash
# from the repo root, with a checkout of main
STRIPE_SECRET_KEY=sk_live_xxx npm run seed:stripe
git add src/data/stripe-price-map.json
git commit -m "Seed Stripe price map"
git push           # (open a PR / merge so prod has the price ids)
```
> Use `sk_test_...` first to rehearse; switch to `sk_live_...` for production.
> The script is idempotent — safe to re-run.

### 2b. Vercel env vars
| Variable | Where to get it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → API keys (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | see 2c (`whsec_...`) |

### 2c. Webhook
1. Stripe → Developers → Webhooks → **Add endpoint**.
2. Endpoint URL: `https://<YOUR_SITE_URL>/api/stripe/webhook`
3. Events: at minimum `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed` (add others your flow needs).
4. Copy the **Signing secret** (`whsec_...`) → set `STRIPE_WEBHOOK_SECRET` in Vercel.

---

## 3. Transactional email  →  Resend (2 vars)

Drives verification emails, approval notices, announcements, board-application
receipts. Without it, email is a **silent no-op** (nothing sends, nothing breaks).

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys (`re_...`) |
| `RESEND_FROM_EMAIL` | A **verified** sender, e.g. `noreply@abcac.org` (verify the domain in Resend first) |

---

## 4. Optional

| Variable | Purpose |
|---|---|
| `CERT_SCHEDULES_CSV` | Path/URL for `npm run import:cert-schedules` (renewal schedule import) |

---

## 5. After setting keys — smoke test
1. Redeploy in Vercel.
2. Open the site → chat widget should respond (AI on).
3. `/store` → start a checkout → should reach Stripe (payments on).
4. Trigger a verification/contact email → arrives (email on).
5. Sign in as `brianreinhart3617@gmail.com` → `/admin` loads (superadmin),
   member detail → create a task, mark a CEU reviewed, send a message.

---

## Account facts (current)
- Live DB: migrations **001–027 applied**, RLS on **100%** of tables.
- God account: **brianreinhart3617@gmail.com** = `superadmin` (full access).
- Member Portal button points to the unified **`/account`** app. The legacy
  static `/portal` remains as a fallback until you confirm cutover — then it can
  be removed.
