# SCHEMA-CURRENT.md — Supabase schema as implemented by migrations 001–013

Project ref: `ajgqqfggdctmcqhbmptb` (`https://ajgqqfggdctmcqhbmptb.supabase.co`).
This document reflects only what the SQL in `supabase/migrations/001..013` actually creates — no invented tables/columns/credentials. Every table has RLS enabled; the standard pattern is a **member policy** (own rows, keyed on `auth.uid()`) OR-ed with an **admin policy** (`public.is_admin()`).

Source of truth: schema = migration 001; admin layer = 002; automation triggers = 003/005/008/012; website/commerce = 004; signup/approval = 006/007; hardening = 009/011; doc requests = 010; cert read-only = 013.

---

## Helper functions / triggers (cross-table)

| Object | Migration | Purpose |
|--------|-----------|---------|
| `update_updated_at()` + triggers `tr_profiles_updated`, `tr_certs_updated` | 001 | BEFORE UPDATE: stamps `updated_at`. |
| `public.handle_new_user()` (SECURITY DEFINER) + trigger `on_auth_user_created` AFTER INSERT on `auth.users` | 001 → 006 → 007 | Creates a `profiles` row + `notification_preferences` row for each new auth user. 006 copies `first_name/last_name/phone/cert_status` from `raw_user_meta_data`. 007 sets new signups to `account_status='pending'`. Uses `ON CONFLICT DO NOTHING`. |
| `public.is_admin()` (SECURITY DEFINER, STABLE, `search_path=public`) | 002 | `EXISTS(select 1 from profiles where id=auth.uid() and portal_role='admin')`. Bypasses RLS to avoid recursion. Used by every `admin_all_*` policy and the storage admin-read policy. |
| `public.notify_events()` (SECURITY DEFINER) | 003 → 012 | Reads Vault secrets `edge_functions_url` + `service_role_key`; if unset, **no-ops** (returns NEW). Otherwise `net.http_post` to `<fn_url>/events` with `{type, table, record}`. 012 rewrites it so `profiles` payloads send only safe columns (id, email, first/last name, account_status) instead of `to_jsonb(NEW)` (avoids leaking `ssn_last4`, `date_of_birth`). |
| `public.guard_profile_update()` (SECURITY DEFINER) + trigger `tr_guard_profile_update` BEFORE UPDATE on `profiles` | 009 → 011 | For non-admin / non-service-role callers, forces `portal_role`, `account_review_notes`, `account_reviewed_at`, `stripe_customer_id` (added 011) back to OLD values, and only allows a member to move `account_status` to `'pending'` (never self-approve). Prevents privilege escalation under the permissive `members_own_profile` FOR ALL policy. |
| pg_cron job `abcac-daily-reminders` (`0 14 * * *` ≈ 7am MST) | 003 | Calls `<fn_url>/scheduled-reminders` daily via `net.http_post`. Requires `pg_cron` + `pg_net` extensions and Vault secrets. |

**notify_events INSERT triggers** (003): `tr_events_profiles`, `tr_events_documents`, `tr_events_ceu`, `tr_events_name_change`, `tr_events_verification`, `tr_events_reciprocity`.
**notify_events UPDATE (status-change) triggers** (005, fire only WHEN `OLD.status IS DISTINCT FROM NEW.status`): `tr_status_application`, `tr_status_document`, `tr_status_ceu`.
**notify_events UPDATE (account-submission) trigger** (008): `tr_account_submitted` on `profiles` WHEN `account_submitted_at` newly set AND `account_status='pending'`.

---

## Tables

### `public.profiles` (001; extended 006/007/011)
PK `id UUID` → `auth.users(id)` ON DELETE CASCADE.
Columns: `first_name, middle_name, last_name TEXT`; `email TEXT UNIQUE NOT NULL`; `phone, ssn_last4, address_line1, city TEXT`; `state TEXT DEFAULT 'Arizona'`; `zip_code TEXT`; `date_of_birth DATE`; `cert_status TEXT DEFAULT 'applying'`; `portal_role TEXT DEFAULT 'member'`; `created_at/updated_at TIMESTAMPTZ`.
Added 007: `account_status TEXT NOT NULL DEFAULT 'approved'` (pending|approved|rejected — default 'approved' backfills existing members; only `handle_new_user` sets new signups to 'pending'), `account_submitted_at`, `account_reviewed_at TIMESTAMPTZ`, `account_review_notes TEXT`.
Added 011: `stripe_customer_id TEXT`.
RLS: `members_own_profile` FOR ALL `auth.uid()=id` (001); `admin_all_profiles` FOR ALL `is_admin()` (002). Column immutability enforced by `guard_profile_update()` trigger (009/011).

### `public.certifications` (001; 004 adds sync; 013 restricts member writes)
PK `id`; `member_id` → profiles ON DELETE CASCADE. Columns: `cert_type TEXT NOT NULL`, `cert_number TEXT UNIQUE`, `issued_date DATE`, `expiration_date DATE`, `ic_rc_level TEXT`, `status TEXT DEFAULT 'active'`, `created_at/updated_at`.
Added 004: `sync_enabled BOOLEAN NOT NULL DEFAULT FALSE` (Certification Sync; toggled only by Stripe webhook/service role).
Indexes: `idx_certs_member(member_id)`, `idx_certs_expiration(expiration_date)`.
RLS: **`members_read_certs` FOR SELECT only** (013 dropped the original `members_own_certs` FOR ALL — members can no longer INSERT/UPDATE/DELETE credentials); `admin_all_certs` FOR ALL `is_admin()` (002). This is the system of record for ISSUED credentials — written only by admin console / service role.

### `public.ceu_records` (001)
PK `id`; `member_id`→profiles CASCADE; `cert_id`→certifications (nullable). Columns: `course_name TEXT NOT NULL`, `provider TEXT NOT NULL`, `hours NUMERIC(4,1) NOT NULL`, `category TEXT NOT NULL`, `completion_date DATE NOT NULL`, `certificate_url TEXT` (storage path), `status TEXT DEFAULT 'pending'`, `admin_notes TEXT`, `submitted_at`, `reviewed_at`.
Index `idx_ceu_member`. RLS: `members_own_ceu` FOR ALL `auth.uid()=member_id` (001); `admin_all_ceu` (002).

### `public.documents` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `document_type TEXT NOT NULL`, `related_cert TEXT`, `file_name TEXT NOT NULL`, `file_path TEXT NOT NULL` (storage path), `file_size_kb INTEGER`, `status TEXT DEFAULT 'pending'`, `admin_notes TEXT`, `uploaded_at`, `reviewed_at`.
Index `idx_docs_member`. RLS: `members_own_docs` FOR ALL (001); `admin_all_docs` (002).

### `public.employment_records` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `employer_name`, `position_title TEXT NOT NULL`, `start_date`, `end_date DATE`, `is_current BOOLEAN DEFAULT FALSE`, `created_at`.
RLS: `members_own_employment` FOR ALL (001); `admin_all_employment` (002).

### `public.other_certifications` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `credential_title TEXT NOT NULL`, `credential_number TEXT`, `issuing_board TEXT NOT NULL`, `issued_date`, `expiration_date DATE`, `created_at`.
RLS: `members_own_other_certs` FOR ALL (001 — intentionally member-writable per 013 note); `admin_all_other_certs` (002).

### `public.supervision_records` (001)
PK `id`; **`supervisor_id`** → profiles CASCADE (keyed on the supervisor, not member_id). Columns: `supervisee_name TEXT NOT NULL`, `supervisee_credential TEXT`, `start_date`, `end_date DATE`, `status TEXT DEFAULT 'active'`, `created_at`.
RLS: `members_own_supervision` FOR ALL `auth.uid()=supervisor_id` (001); `admin_all_supervision` (002).

### `public.applications` (001; 005 adds attestation)
PK `id`; `member_id`→profiles CASCADE. Columns: `app_type TEXT NOT NULL`, `cert_type TEXT`, `status TEXT DEFAULT 'submitted'`, `submitted_at`, `reviewed_at`, `admin_notes TEXT`, `est_completion DATE`.
Added 005: `member_notes TEXT`, `attested BOOLEAN NOT NULL DEFAULT FALSE`, `attested_at TIMESTAMPTZ`, `signature_name TEXT`.
RLS: `members_own_applications` FOR ALL (001); `admin_all_applications` (002).

### `public.name_change_requests` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `current_name TEXT NOT NULL`, `new_name TEXT NOT NULL`, `reason TEXT NOT NULL`, `doc_path TEXT` (nullable — supporting doc), `status TEXT DEFAULT 'pending'`, `admin_notes TEXT`, `submitted_at`, `reviewed_at`.
RLS: `members_own_name_change` FOR ALL (001); `admin_all_name_change` (002).

### `public.verification_requests` (001)
PK `id`; `member_id`→profiles CASCADE; `cert_id`→certifications (nullable). Columns: `purpose TEXT NOT NULL`, `recipient_name TEXT NOT NULL`, `recipient_email TEXT`, `notes TEXT`, `status TEXT DEFAULT 'pending'`, `submitted_at`, **`completed_at`** (no `reviewed_at` — review actions stamp `completed_at`).
RLS: `members_own_verifications` FOR ALL (001); `admin_all_verifications` (002).

### `public.reciprocity_requests` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `direction TEXT NOT NULL` (`out_of_az`|`into_az`), `credential TEXT`, `destination TEXT`, `reason TEXT`, `status TEXT DEFAULT 'pending'`, `submitted_at`, `reviewed_at`.
RLS: `members_own_reciprocity` FOR ALL (001); `admin_all_reciprocity` (002).

### `public.messages` (001; 009 restricts inserts)
PK `id`; `member_id`→profiles CASCADE. Columns: `from_name TEXT DEFAULT 'ABCAC Admin'`, `subject TEXT NOT NULL`, `body TEXT`, `is_read BOOLEAN DEFAULT FALSE`, `created_at`.
Index `idx_messages_member`. RLS (after 009 dropped `members_own_messages`): **`members_read_messages` FOR SELECT** + **`members_update_messages` FOR UPDATE** (mark-read only — members cannot INSERT a message into their own inbox); `admin_all_messages` FOR ALL (002, the only insert path). **One-directional: admin→member only** (see GAP-ANALYSIS Messages).

### `public.invoices` (001)
PK `id`; `member_id`→profiles CASCADE. Columns: `invoice_number TEXT UNIQUE NOT NULL`, `description TEXT NOT NULL`, `amount_cents INTEGER NOT NULL`, `status TEXT DEFAULT 'unpaid'`, `stripe_payment_intent TEXT`, `paid_at`, `created_at`.
Index `idx_invoices_member`. RLS: `members_own_invoices` **FOR SELECT** (001); `admin_all_invoices` FOR ALL (002). Members read-only; created by admin console or `scheduled-reminders` Edge Function (service role).

### `public.notification_preferences` (001)
PK `id`; `member_id UUID UNIQUE` → profiles CASCADE. Columns: `renewal_reminders BOOLEAN DEFAULT TRUE`, `ceu_deadline_alerts BOOLEAN DEFAULT TRUE`, `abcac_announcements BOOLEAN DEFAULT TRUE`, `icrc_updates BOOLEAN DEFAULT FALSE`, `updated_at`.
RLS: `members_own_prefs` FOR ALL (001); `admin_all_prefs` (002). Auto-created by `handle_new_user`.

### `public.admin_audit_log` (002)
PK `id`; `admin_id`→profiles. Columns: `action TEXT NOT NULL`, `target_table TEXT`, `target_id UUID`, `details JSONB`, `created_at`.
RLS: `admin_audit_rw` FOR ALL `is_admin()` (no member access). Populated best-effort by admin client components (review-actions, issue-cert, member-manage, send-message, etc.).

### `public.payments` (004)
PK `id`; `member_id`→profiles ON DELETE **SET NULL** (guest checkout allowed); `application_id`→applications SET NULL. Columns: `stripe_session_id TEXT`, `stripe_event_id TEXT UNIQUE` (webhook idempotency guard), `slug TEXT`, `product_name TEXT`, `amount_cents INTEGER NOT NULL DEFAULT 0`, `currency TEXT NOT NULL DEFAULT 'usd'`, `mode TEXT NOT NULL DEFAULT 'payment'` (payment|subscription), `credential_level TEXT`, `exam_mode TEXT`, `status TEXT NOT NULL DEFAULT 'paid'`, `created_at`.
Index `idx_payments_member`. RLS: `members_own_payments` FOR SELECT; `admin_all_payments` FOR ALL. Inserted by the Stripe webhook (service role, bypasses RLS).

### `public.contact_messages` (004)
PK `id`; Columns: `name TEXT NOT NULL`, `email TEXT NOT NULL`, `phone TEXT`, `message TEXT NOT NULL`, `created_at`.
RLS: `admin_read_contact` FOR SELECT `is_admin()` only. Inserted by `/api/contact` and `/api/board-application` (service role) as a fallback when Resend isn't configured.

### `public.document_requests` (010)
PK `id`; `member_id`→profiles CASCADE. Columns: `document_type TEXT NOT NULL`, `note TEXT`, `status TEXT NOT NULL DEFAULT 'open'` (open|fulfilled), `created_at`, `fulfilled_at`.
Index `idx_docreq_member`. RLS: `members_read_docreq` FOR SELECT + `members_update_docreq` FOR UPDATE; `admin_all_docreq` FOR ALL. Admins create requests; members see them on the Documents page.

---

## Storage buckets (002 — all PRIVATE)

`INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING`:
- **`member-documents`** (private) — general document uploads + application supporting docs.
- **`ceu-certificates`** (private) — CEU certificate-of-completion uploads.
- **`name-change-docs`** (private) — name-change supporting documents (bucket exists but no portal UI uploads to it; see GAP-ANALYSIS).

Storage RLS (`storage.objects`):
- Member INSERT + SELECT on each bucket gated by `auth.uid()::text = (storage.foldername(name))[1]` (uploads land under `<uid>/...`). Policies: `member_upload_docs`/`member_read_docs` (001), `member_upload_ceu`/`member_read_ceu` (001), `member_upload_namechange`/`member_read_namechange` (002).
- `admin_read_all_storage` (002) — SELECT on all three buckets when `is_admin()` (review queues use signed URLs).

---

## Promote first admin (manual, per 002/GO-LIVE-UNIFIED)
```sql
update public.profiles set portal_role='admin', account_status='approved'
where email='abcac@abcac.org';
```

## Not present in migrations (relevant to the brief)
- **No `cert_schedules` / cert due-dates engine table** — renewal dates live only on `certifications.expiration_date`; the 90/60/30-day logic is computed at read time (portal) and in `scheduled-reminders`.
- No public-website verification-request table/flow (verification is member-portal only).
- No member-authored messages table/column (messages are admin→member only).
