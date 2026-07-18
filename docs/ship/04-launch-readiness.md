# 04 — Launch Readiness: Go/No-Go + Smoke Test

Use this as the final gate. Launch only when every 🔴 row is checked and the smoke test passes on the
production deployment.

---

## Go/No-Go checklist

### Hard blockers (🔴 — must be green)
- [ ] Live Stripe checkout succeeds end-to-end (price map seeded, keys set, webhook registered &
  confirmed on `/api/stripe/webhook`).
- [ ] All 🔴 env vars set in Vercel (Supabase URL/anon/service-role, Stripe, site URL).
- [ ] Live DB schema matches `supabase/migrations/**` through `036`.
- [ ] Admin account promoted (`portal_role='admin'`, `account_status='approved'`) and can log in.
- [ ] Supabase Auth: site URL + `/auth/callback` redirects + email confirmations configured.
- [ ] Mock-data surfaces resolved — either hidden behind a flag or wired to real data (see
  [`02-code-work.md`](02-code-work.md) C1). No demo dataset visible to real users.
- [ ] Legal pages exist and consent/footer links resolve (C3).
- [ ] Legacy static `/portal` retired or intentionally gated (C2).

### Required-for-feature (🟠)
- [ ] Resend key + verified `abcac.org` domain → a real approval/receipt email sends.
- [ ] `ANTHROPIC_API_KEY` set → AI navigators respond (or accept graceful-503 degrade at launch).
- [ ] `CRON_SECRET` set + Vercel cron configured → reminders + digest can run.
- [ ] Edge Functions deployed + Vault secrets set (if using DB notify triggers / Edge reminders).
- [ ] Cert schedules imported and spot-checked against the real due-dates spreadsheet.

### Recommended (🟢)
- [ ] GitHub CI running (C4).
- [ ] Reserve superadmin seeded.
- [ ] Automation confirmed OFF for launch (or Phase-1 guards + tests in — see
  [`03-automation-rollout.md`](03-automation-rollout.md)).
- [ ] Durable rate limiter (KV/Upstash) if heavy public traffic expected.

---

## End-to-end smoke test (run on production after deploy)

**Public → signup → approval**
1. Load home, cert-path pages, `/store`, `/verify`, `/directory`, `/contact` → all 200, no error boundary.
2. Submit `/contact` → appears in `/admin/inbox`.
3. Sign up a test member → email confirmation arrives → confirm → land in `/account` (pending state).
4. As admin, approve the account in `/admin/approvals` → member receives credentials email → member
   status flips to approved.

**Member journey**
5. Member: complete profile, add employment, upload a document, log a CEU, submit a name-change and a
   verification request → each persists and appears in the matching admin queue.
6. Member: start a renewal → $150 invoice generated → pay via Stripe test → webhook marks paid →
   receipt downloadable.

**Admin actions**
7. Admin: approve the CEU, issue a certificate (with `certificate_url`), decide the name-change and
   verification → member sees the results; certificate downloads via signed URL.
8. Admin: `/admin/reports`, `/finance`, `/compliance`, `/schedules`, `/audit` render **real** numbers
   (not the demo dataset).

**Payments integrity**
9. A completed checkout writes a `payments` row attributed to the right member; reciprocity-OUT $150
   reconciles via metadata; `certification-sync` sets `sync_enabled=true`.

**AI + security**
10. Member AI navigator answers and only ever touches the member's own rows; admin navigator can look
    up any member; website assistant answers with no DB access.
11. Confirm a logged-in member **cannot** self-edit `cert_status`/legal name/`portal_role`/
    `account_status` via direct PostgREST (migration 036 guard).
12. `/api/cron/*` rejects requests without the `CRON_SECRET` bearer.

**Any failure here is a no-go** until fixed. When all pass and every 🔴 is checked, cut `abcac.org`
over to Vercel.

---

## After launch (first week)
- Watch the automation daily digest (even with workflows off, the digest surfaces queue health).
- Watch Stripe webhook delivery + Resend send logs for failures.
- Confirm the daily reminder cron actually fired and deduped.
- Then begin automation Phase 1 if desired (see `03`).
