# ABCAC — Backlog / To Work On

## Security audit — resolved items
- [x] **Privilege escalation / self-approval** — `guard_profile_update()` BEFORE trigger (migration 009) blocks members from self-promoting role or self-approving account.
- [x] **XSS** — addressed in middleware and admin console (role check enforced server-side).
- [x] **CEU file validation** — validated in the portal upload flow.
- [x] **Admin middleware role check** — middleware confirms `portal_role = 'admin'` before rendering any `/admin/*` route.
- [x] **Stripe customer binding** — `stripe_customer_id` added to profiles (migration 011); webhook writes it on checkout; guard prevents members from modifying it.
- [x] **PII in webhook payload** — migration 012 rewrites `notify_events()` to send only safe columns for `profiles` rows, stripping `ssn_last4` / `date_of_birth`.
- [x] **Legacy `stripe-webhook` Edge Function idempotency** — `stripe_event_id` guard added; duplicate events return early without side-effects.
- [x] **Admin email-on-submission** — migration 008 fires `notify_events()` → `events` Edge Function when a member submits their account for approval.

## Security audit — remaining (lower severity)
- [ ] **Contact form rate limiting / CAPTCHA** (LOW) — no rate limit on `/api/contact`.
- [ ] **Legacy portal `getSession()` → `getUser()`** (LOW) — only affects the deprecated static portal; moot once it is retired.

## Known follow-ups
- [ ] **Retire the static `/portal` + `/portal/admin`** — the native Next.js member portal (`/account/*`) and admin console (`/admin/*`) have full parity; no in-app links point to the static app. Safe to remove `frontend/public/portal/` and root `index.html`/`admin.html` when ready.
- [ ] Per-credential required-document rules (admin-configurable).
- [ ] E-signature audit trail / downloadable signed application PDF.
- [ ] Financial reporting (refunds, receipts export).
