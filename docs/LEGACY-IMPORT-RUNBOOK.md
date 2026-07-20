# Legacy Member Import & Portal Invite Runbook

How to load the board's historical member database into the platform and invite
everyone to claim their portal account. Written so it can be handed to anyone;
the actual commands are typically run by the developer/agent with the service
key, not by board staff.

## What you need

1. **The member database export** — CSV or Excel (Excel gets converted to CSV
   first). Column names do not need to match exactly: the importer recognizes
   common variations ("E-mail", "Email Address", "Cert #", "Expiration Date",
   etc.). Ideal columns, in any order:

   | Column | Example | Required? |
   |---|---|---|
   | First Name | Maria | recommended |
   | Last Name | Gonzalez | recommended |
   | Email | maria@example.com | required to invite |
   | Phone | (602) 555-0142 | optional |
   | Credential | CADAC | recommended |
   | Cert Number | CADAC-04471 | recommended |
   | Issued Date | 3/15/2023 | optional |
   | Expiration Date | 3/15/2027 | recommended |
   | IC&RC Level | II | optional |
   | Notes | anything | optional |

   One row per credential — a person with two credentials appears twice with
   the same email and is invited once. Extra columns are kept verbatim in the
   record's `source_row`, so nothing in the export is lost even if unrecognized.
   A ready-made template: `docs/legacy-import-template.csv`.

2. **Supabase service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) — both scripts
   write with admin privileges. Never commit it.

3. Migrations `042_legacy_members.sql` (done 2026-07-20) and
   `043_legacy_member_status.sql` applied to the live database.

The master spreadsheet's row colors carry standing: green → `active`, red →
`inactive`, anything else → `review`. The conversion from the board's Excel
master workbook produces a CSV with a `Status` column plus mailing-address
columns, which the importer maps automatically.

## Step 1 — Dry-run the import

```bash
SUPABASE_URL=https://ajgqqfggdctmcqhbmptb.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/import-legacy-members.ts members.csv --batch 2026-07-initial --dry-run
```

Prints the header mapping, any unmapped columns, the parsed row count, and the
first 3 rows. Verify names/dates/credentials look right before going further.

## Step 2 — Import for real

Same command without `--dry-run`. Re-running with the same `--batch` id wipes
and reloads that batch, so a corrected export can be re-imported safely without
duplicates. After import, the roster appears in **Admin → Legacy Records**, and
the **Account Approvals** queue starts flagging signups that match a legacy
record by email or self-reported cert number.

## Step 3 — Create accounts (no email) or invite in batches

**Pre-populate mode** — create every account up front without sending a single
email (right choice before the email domain / DNS are ready):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/invite-legacy-members.ts --create-only --provision --include-inactive --limit 500 --dry-run
```

Accounts are created silently, pre-approved, profile filled (name, phone,
address), and certification rows issued — `active` for green-status members,
`expired` for red. Members appear in Admin → Members immediately, and their
portal is complete the first time they log in. Since no email goes out,
`invited_at` stays empty — a later email campaign can find exactly who hasn't
been notified yet. Until then, members can use **Forgot password** on the
login page to get in.

**Invite mode** — sends a Supabase invite email (member sets a password via
the link):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SITE_URL=https://abcac.org \
npx tsx scripts/invite-legacy-members.ts --limit 50 --provision --dry-run
```

- `--dry-run` first: lists exactly who would be processed.
- `--provision` (recommended): pre-approve + issue credentials as above.
- `--include-inactive`: also process red/review-status records (default is
  active only).
- `--limit 50`: batch size for invite mode. Start small (25–50/day), watch
  deliverability, then ramp. Processed rows are stamped and skipped on
  re-runs, so running daily walks the roster automatically.

> **Send invite emails only after** the Resend/email domain is verified and
> DNS has cut over — the link uses `NEXT_PUBLIC_SITE_URL`, and members will
> explore the site they land on. Accounts already created with
> `--create-only` are skipped by invite mode; notify them later with a
> password-setup campaign (their rows have an account but no `invited_at`).

## Monitoring

**Admin → Legacy Records** shows imported / invited / claimed counts, plus a
searchable roster with per-person claim status. Re-run step 3 until "Invited"
reaches everyone with an email; chase the remainder (no email on file) by
phone or mail.
