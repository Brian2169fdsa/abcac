# ABCAC — Backlog / To Work On

## Flagged
- [ ] **Admin email-on-submission** — notify ABCAC staff by email the moment a
  new account registration (or document/CEU/application) is submitted, so the
  approval queue gets worked promptly. Builds on the `events` Edge Function and
  the migration-005 status triggers. *(Requested.)*

## Security audit — remaining (lower severity; HIGH items already fixed in migration 009 + middleware + CEU validation)
- [ ] **Stripe customer binding** (MED): billing portal looks up the customer by
  email — store `stripe_customer_id` on `profiles` at checkout and look up by id.
- [ ] **Legacy `stripe-webhook` Edge Function idempotency** (MED): add a
  `stripe_event_id` guard, or decommission it (the Next.js `/api/stripe/webhook`
  is the live one — only register that endpoint in Stripe).
- [ ] **PII in webhook payload** (LOW): `notify_events()` sends `to_jsonb(NEW)`,
  which for `profiles` includes `ssn_last4`/`date_of_birth` to the events
  function. Send only the columns the notification needs.
- [ ] **Contact form rate limiting / CAPTCHA** (LOW).
- [ ] **Legacy portal `getSession()` → `getUser()`** (LOW) — only affects the
  deprecated static portal.
- [ ] Hardcoded anon key in static HTML (LOW, by design public) — moot once the
  static portal is retired and the RLS escalation is fixed (done).

## Known follow-ups
- [ ] **Retire the static `/portal` + `/portal/admin`** — the native Next.js
  member portal (/account/*) and admin console (/admin/*) now have full parity,
  and no in-app links point to the static app anymore. Safe to remove
  `frontend/public/portal/` + root `index.html`/`admin.html` when ready.
- [ ] Per-credential required-document rules (admin-configurable).
- [ ] E-signature audit trail / downloadable signed application PDF.
- [ ] Financial reporting (refunds, receipts export).
- [ ] Admin: request a *specific* missing document from a member.
