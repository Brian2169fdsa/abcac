# Member Data Import — Final Report (2026-07-20)

Source: the board's master Excel database ("ABCAC_Master_Data_base.xlsx"),
row colors green = active, red = inactive.

## Results

| Metric | Count |
|---|---|
| People imported to the roster (Admin → Legacy Records) | **455** |
| — Active standing (green rows) | 124 |
| — Inactive standing (red rows) | 321 |
| — Needs review (yellow/orange rows) | 10 |
| Member **accounts created** (everyone with an email) | **283** |
| Certifications issued (incl. historical types ADC, PS, CS, AAC, CAADAC, CAC/ADC) | ~300 |
| — recorded as active | 156 |
| — recorded as expired (inactive members) | ~144 |
| Roster people with **no email** (roster-only, no account) | 143 |

Every created account is **pre-approved** with name, phone, and mailing
address filled from the spreadsheet; active members' portals show their real
credential with a downloadable PDF certificate and wallet card. **No emails
were sent to anyone** — accounts are silent until the invite campaign runs.

Extras recovered during import: 16 additional email addresses cross-referenced
from the CADAC/CCJP/CPS/CCS and IC&RC tabs; credentials parsed out of cert
numbers like "1944-CADAC"; 3 typo'd emails repaired (a `mailto:` prefix, a
trailing `>`, and `qmail>com` → `qmail.com`).

## Open items

1. **10 "Review" people** — classify as active/inactive in Admin → Legacy Records
   (they were highlighted yellow/orange in the spreadsheet, meaning unknown).
2. **Andrea Thorpe** — verify `sobrietylifecoach@qmail.com` (possible gmail typo).
3. **143 people without email** — visible in the roster; as emails are found,
   accounts can be created the same way (the import/invite scripts are idempotent).
4. **Two people marked Deceased/Retired** in the spreadsheet were imported with
   that note preserved — review whether their records should stay.

## How signups cross-check against the roster

When someone creates their own account, the Admin → Account Approvals queue
shows a green **"Legacy match"** pill if their email or self-reported cert
number matches a roster record — instant confirmation they're a real
credential holder.

## Rerunning / extending (technical)

```bash
# Import an updated spreadsheet export (CSV) — idempotent per batch id
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/import-legacy-members.ts members.csv --batch 2026-08-update --dry-run

# Create accounts for newly-emailed people (no email sent)
npx tsx scripts/invite-legacy-members.ts --create-only --provision --include-inactive --limit 500 --dry-run

# Send invite emails (after Resend + DNS are live)
npx tsx scripts/invite-legacy-members.ts --provision --limit 50 --dry-run

# Back-fill any certification rows that failed (idempotent)
npx tsx scripts/repair-legacy-certs.ts --dry-run
```

Full details: `docs/LEGACY-IMPORT-RUNBOOK.md`.
