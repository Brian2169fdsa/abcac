# ABCAC Member Portal — Launch Checklist (credentials & records first, payments after)

> PHX Creative Works, 2026-09-12. The plan agreed with ABCAC: open the portal to the 283 existing
> members with online payment switched off, then turn payments on once live Stripe is verified.
> Code for everything below is on branch `claude/tender-allen-fr2r8i`. Items marked **Owner** are
> settings only you can make; everything else is done.

## What ships in this launch

Sign in and password reset · dashboard · certificate and wallet-card download · profile, password,
notification preferences, directory opt-out · CEU log and compliance tracker · documents and
staff-requested documents · employment and supervision · digital applications and recertification
packets (submit now, pay later) · outside signers · Application Status · exam pre-registration
(saved, pay later) · name change, verification, reciprocity requests · messages · notifications
(now including staff decisions) · activity · public verify and directory.

Off for launch: every Stripe button (replaced by a "payment opens shortly" notice), Certification
Sync (hidden while payments are off), the AI assistant (until its key is set), the public
transcript-export route (removed).

## Owner steps, in order

| # | Step | Where | Why |
|---|---|---|---|
| 1 | **Owner** Run `docs/ship/apply-046-048.sql` | Supabase → SQL Editor | Closes the CEU/document self-approval gap, retires the duplicate reminder schedule, turns on decision notifications. Run the VERIFY block at the bottom and confirm 10 triggers, 0 cron jobs. |
| 2 | **Owner** Resend: create account, add domain `abcac.org`, add the DNS records it shows, wait for Verified, create an API key | resend.com | Every portal email (password campaign, receipts, decisions, reminders). |
| 3 | **Owner** Vercel env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply@abcac.org`, `CRON_SECRET` (long random string), `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `PORTAL_ACCOUNT_APPROVAL_REQUIRED=true` | Vercel → Project → Settings → Environment Variables (Production) | Payments paused, approval gate on, reminders armed. |
| 4 | **Owner** Supabase Auth → SMTP Settings: enable custom SMTP using Resend (`smtp.resend.com`, port 465, user `resend`, password = the API key, sender `noreply@abcac.org`) | Supabase → Authentication → SMTP | Supabase's built-in mailer allows only a few emails per hour. Without this, the password-reset campaign stalls on the first batch. |
| 5 | **Owner** Supabase Auth → URL Configuration: Site URL = the production portal URL; add `https://<portal-host>/auth/callback` to Redirect URLs | Supabase → Authentication → URL Configuration | Password-reset and confirmation links must be allowed to return to the portal. |
| 6 | **Owner** Domain: add `portal.abcac.org` (or your choice) to the Vercel project, create the CNAME at your DNS host, set `NEXT_PUBLIC_SITE_URL=https://portal.abcac.org`, redeploy | Vercel → Domains; DNS host | Keeps the current abcac.org site untouched while members use the portal. Add a "Member Portal" link on the Duda site pointing here. |
| 7 | Merge the branch and confirm the Vercel deployment is green | GitHub | — |
| 8 | Smoke test on production (30 minutes, together): sign in as a test member via Forgot password → download certificate → log a CEU → upload a document → submit a recertification packet → send a message → as admin, approve the CEU and confirm the member gets the notification | Portal + Admin | Proves the launch set end to end. |
| 9 | **Owner** Classify the 10 "review" roster people and the two deceased/retired records before any email goes out | Admin → Legacy Records | Nobody should receive an invitation who should not. |
| 10 | Send the campaign in batches: `npx tsx scripts/invite-legacy-members.ts --announce --limit 25 --dry-run`, then without `--dry-run`. 25 to 50 per day for the first two days, then ramp | Terminal with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL` | Members get "Your ABCAC member portal is ready" linking to the forgot-password page. Each roster row is stamped so nobody is emailed twice. |
| 11 | Watch for two days: Resend bounces, Supabase Auth logs, Admin → Inbox and Messages, Account Approvals queue | — | Expect a handful of name-typo Name Change Requests and "which email did you use" messages. |

## Turning payments on (days 3 to 5)

1. **Owner** Stripe live keys; run `STRIPE_SECRET_KEY=sk_live_… npm run seed:stripe`; commit the generated `src/data/stripe-price-map.live.json`.
2. **Owner** Vercel env: `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`.
3. **Owner** Stripe → Developers → Webhooks → Add endpoint `https://<portal-host>/api/stripe/webhook`; events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`; copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Set `NEXT_PUBLIC_PAYMENTS_ENABLED=true` (or remove it), redeploy.
5. Make one real low-value purchase (the $25 printed certificate) and confirm it appears in Admin → Finance and the member's Invoices & Receipts with a receipt email.
6. Unhide Certification Sync only after deciding whether it is reworded as a manual request or built properly.

## What members will see if they try to pay before step 4

A notice on the Payments page, on every fee link inside an application, on invoice Pay Now, on exam
registration, and on reciprocity: "Online payment opens shortly. Your form or request is saved and
visible to ABCAC staff. You can pay by check or money order payable to ABCAC (PO Box 83165, Phoenix,
AZ 85071) or wait for the notice that online payment is open." The checkout APIs return 503.

## Still open (not blocking this launch)

- CCS and CPRS renewal hours: the official packets say six, the portal says forty. Confirm with ABCAC.
- Fee text inside the PDFs versus the catalog (certification-only $200 vs $150; CPRS fees).
- Verification letters, subscription self-management, full refund handling, signer-flow polish, and
  the rest of the post-launch list in `MEMBER-PORTAL-FEATURE-STATUS-2026-09.md`.
