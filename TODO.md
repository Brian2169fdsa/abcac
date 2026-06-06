# ABCAC — Backlog / To Work On

## Flagged
- [ ] **Admin email-on-submission** — notify ABCAC staff by email the moment a
  new account registration (or document/CEU/application) is submitted, so the
  approval queue gets worked promptly. Builds on the `events` Edge Function and
  the migration-005 status triggers. *(Requested.)*

## Known follow-ups
- [ ] **Retire the static `/portal` + `/portal/admin`** — the native Next.js
  member portal (/account/*) and admin console (/admin/*) now have full parity,
  and no in-app links point to the static app anymore. Safe to remove
  `frontend/public/portal/` + root `index.html`/`admin.html` when ready.
- [ ] Per-credential required-document rules (admin-configurable).
- [ ] E-signature audit trail / downloadable signed application PDF.
- [ ] Financial reporting (refunds, receipts export).
- [ ] Admin: request a *specific* missing document from a member.
