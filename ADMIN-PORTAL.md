# ABCAC Admin Console — Setup

The admin console lets ABCAC staff review and act on everything members submit.
It lives at **`/admin`** (e.g. `https://portal.abcac.org/admin`) and shares the
same Supabase project and login system as the member portal.

## What it does
- **Dashboard** — live counts of pending documents, CEUs, applications, and requests.
- **Document review** — view each uploaded file (secure signed URL) and approve/reject with a note.
- **CEU review** — approve/reject submitted continuing-education hours.
- **Applications** — change status (submitted → under review → approved/rejected), set an estimated completion date, and notes.
- **Requests** — complete or reject name-change, verification, and IC&RC reciprocity requests.
- **Members** — search the directory, edit certification status, **issue certifications**, and grant/revoke admin role.
- **Send Message** — drop a message into any member's portal inbox.
- **Create Invoice** — issue an invoice to a member (payment collection arrives in a later phase).

Every privileged action is written to an `admin_audit_log` table, and (if email
is configured) the affected member is notified automatically.

## Security model
- Reads and writes across all members are authorized **server-side by Postgres
  Row-Level Security** using `public.is_admin()`, which checks
  `profiles.portal_role = 'admin'`. A normal member's session can never see or
  change another member's data, even though the same anon key is used.
- The login screen additionally rejects any non-admin account before showing the console.
- Email / future Stripe side effects run in the **`admin-notify` Edge Function**
  with the service-role key, which is never exposed to the browser.

## One-time setup
1. **Apply the migration** (adds admin role, policies, audit log, storage buckets):
   ```bash
   supabase db push          # or paste supabase/migrations/002_admin_portal.sql into the SQL editor
   ```
2. **Create the admin's account** by signing up once through the member portal (`/`),
   confirming the email, then promote it:
   ```sql
   UPDATE public.profiles SET portal_role = 'admin' WHERE email = 'abcac@abcac.org';
   ```
3. **(Optional) Enable email notifications** by deploying the Edge Function:
   ```bash
   supabase functions deploy admin-notify
   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL=noreply@abcac.org
   ```
   If `RESEND_API_KEY` is unset, admin actions still work — they just won't send email.
4. Visit **`/admin`** and sign in with the promoted account.

## Notes
- `/admin` is marked `noindex` so it won't appear in search engines.
- Members and admins use the same Supabase users table; the only difference is `portal_role`.
