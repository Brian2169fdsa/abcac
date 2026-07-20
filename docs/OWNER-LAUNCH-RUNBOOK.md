# ABCAC Owner Launch Runbook

> Everything that must be executed **outside the codebase** to take the platform
> live, in order. The code is complete — each step below flips on something
> already built. Updated 2026-07-20.

---

## Step 1 — Fix the Stripe webhook 🔴 (blocks launch — the one real defect)

Payments currently complete at Stripe but are **never recorded in the database**
(no receipt, no Admin → Finance entry, applications don't advance after fee
payment).

1. Open [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks) (test mode toggle ON for now).
2. Click **Add endpoint**.
3. Endpoint URL: `https://<your-vercel-production-domain>/api/stripe/webhook`
   (the domain you open the site with today, e.g. `abcac-manage-ai1.vercel.app` — after DNS cutover, add a second endpoint for `https://abcac.org/api/stripe/webhook`).
4. Events to send: **`checkout.session.completed`**.
5. After creating, click **Reveal** under *Signing secret* and copy it (starts `whsec_`).
6. In [Vercel → Project → Settings → Environment Variables](https://vercel.com/manage-ai1/abcac/settings/environment-variables): set `STRIPE_WEBHOOK_SECRET` to that value (Production), then **Redeploy** the latest deployment.
7. Tell Claude "webhook is in" — a live test purchase will verify it end-to-end.

## Step 2 — Resend email (biggest silent gap; required before member invites)

1. Create an account / sign in at [resend.com](https://resend.com).
2. **Domains → Add Domain** → `abcac.org` → add the DNS records Resend shows (at your DNS host) → wait for *Verified*.
3. **API Keys → Create** → copy the key.
4. In Vercel env vars set: `RESEND_API_KEY` = the key, `RESEND_FROM_EMAIL` = `noreply@abcac.org`. Redeploy.

This turns on: payment receipts, account-approval notices, document-request
notices, renewal reminders, contact-form delivery.

## Step 3 — Remaining Vercel env vars (5 minutes)

| Variable | Where to get it | Turns on |
|---|---|---|
| `CRON_SECRET` | Invent a long random string (e.g. from 1Password generator) | Automated renewal reminders + daily digest |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys | "Need help?" AI chat in portal + admin |
| `CLICKUP_API_TOKEN` | ClickUp → Settings → Apps → API Token | Staff tasks mirror into ClickUp |
| `CLICKUP_LIST_ID` | Open the target ClickUp list — the number in the URL | (same) |

Redeploy after adding. All are optional-but-recommended; each is a silent no-op
until set.

## Step 4 — AZBBHE logo

Save the official AZBBHE logo image as `public/brand/azbbhe-logo.png` in the
repo (or send it to Claude to commit). It automatically appears everywhere the
Arizona Board of Behavioral Health Examiners is referenced.

## Step 5 — Switch Stripe to live money (do last, right before launch)

1. In Stripe: complete business activation if not already (Settings → Business).
2. Get your **live** keys (Developers → API keys, test-mode toggle OFF).
3. On a machine with the repo (or ask Claude): `STRIPE_SECRET_KEY=sk_live_... npm run seed:stripe` — creates the live products/prices and prints the price map to commit.
4. In Vercel env vars swap: `STRIPE_SECRET_KEY` → `sk_live_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`.
5. Add a **live-mode** webhook endpoint (same as Step 1 but with the test toggle OFF) and update `STRIPE_WEBHOOK_SECRET` with the live signing secret. Redeploy.

## Step 6 — DNS cutover (the launch moment)

1. In Vercel → Project → Settings → Domains: add `abcac.org` and `www.abcac.org`.
2. Vercel shows the DNS records needed (an A record `76.76.21.21` and a CNAME for www, or nameserver instructions).
3. At your current DNS host (where abcac.org is registered), replace the Duda records with Vercel's.
4. Also set `NEXT_PUBLIC_SITE_URL=https://abcac.org` in Vercel env vars and redeploy.
5. Old Duda site stops serving once DNS propagates (minutes to a few hours).

## Step 7 — Post-launch smoke test (Claude runs this)

Signup → application → payment (live-mode $1 test or real fee) → admin
approval → certificate download. Say "run the smoke test" after Steps 1–6.

## Step 8 — Member "your portal is ready" campaign

283 member accounts already exist (no email has been sent to anyone). After
Steps 2 + 6, the campaign sends password-setup emails in batches — Claude runs
it with the service-role key: start with 25–50/day, watch bounces, ramp up.
Members can already log in today via **Forgot password** on the login page.

## Step 9 — Cleanup + decisions (anytime)

- Delete demo/test data: the seeded `cs_demo_*` payment rows and the
  `brian+abcac-e2e-test@manageai.io` account (Admin → Members, or ask Claude).
- Classify the **10 "Review"-status roster people** (Admin → Legacy Records)
  as active or inactive.
- Confirm **Andrea Thorpe's** email — imported as `sobrietylifecoach@qmail.com`
  ("qmail" may be a typo for "gmail").
- **143 roster people have no email** — as you find emails, add them and Claude
  can create their accounts the same way.
- Decide which of the **16 automation workflows** (shipped OFF) to enable —
  see `docs/ship/03-automation-rollout.md`.
- Delete the two legacy Supabase Edge Functions (`stripe-webhook`,
  `create-checkout`) in the Supabase dashboard → Edge Functions (dead code;
  removing avoids any double-processing risk).

---

## Quick reference — what's already done

- ✅ Full platform code: site, member portal, admin console (PRs #160–#167 merged)
- ✅ Live DB migrations 001–045 applied; exam schedules seeded
- ✅ 455 legacy members imported; 283 accounts created & provisioned; ~300 certifications issued
- ✅ Payments checkout works end-to-end in test mode (only the webhook recording is pending — Step 1)
- ✅ SEO blog with 10 articles + branded images
- ✅ Test suite: 1,000+ tests green
