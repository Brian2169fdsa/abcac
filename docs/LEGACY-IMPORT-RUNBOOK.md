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

3. Migration `042_legacy_members.sql` applied to the live database (done
   2026-07-20).

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

## Step 3 — Invite in batches

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SITE_URL=https://abcac.org \
npx tsx scripts/invite-legacy-members.ts --limit 50 --provision --dry-run
```

- `--dry-run` first: lists exactly who would be emailed.
- `--provision` (recommended): the invited account arrives pre-approved with
  their certification row(s) issued from the legacy data — first login shows
  their credential and a downloadable certificate. Without it they land in the
  normal approval queue.
- `--limit 50`: batch size. Start small (25–50/day), watch deliverability and
  replies, then ramp up. Invited rows are stamped and skipped on re-runs, so
  running the command daily walks through the roster automatically.

Each member receives a Supabase invite email, clicks the link, sets a
password, and lands in the portal.

> **Send invites only after** the Resend/email domain is verified and DNS has
> cut over to the new site — the invite link uses `NEXT_PUBLIC_SITE_URL`, and
> members will explore the site they land on.

## Monitoring

**Admin → Legacy Records** shows imported / invited / claimed counts, plus a
searchable roster with per-person claim status. Re-run step 3 until "Invited"
reaches everyone with an email; chase the remainder (no email on file) by
phone or mail.
