# 06 — Auth & Member Portal Integration

## Context
This frontend shares the Supabase backend with the management/admin panel (separate track). The public site becomes the **member-facing door** of that portal: members log in, see their credential status and payment history, and renew. The admin panel manages the same data. **Do not redesign the schema** — code against the contract below and confirm exact column names against the management-panel build (log mismatches in `DECISIONS.md`).

## Task
Add Supabase auth, a gated member account surface, contact-form handling, and the Supabase write paths the Stripe webhook depends on.

## Assumed schema contract (additive only; confirm against admin build)
- `members` — `id (uuid)`, `auth_user_id (uuid, fk auth.users)`, `full_name`, `email`, `phone`, `created_at`
- `credentials` — `id`, `member_id (fk)`, `level (CAC|CADAC|AADC|CCS|CCJP|CPRS|CPS)`, `status (pending|active|expired)`, `issued_at`, `expires_at`, `sync_enabled (bool)`
- `payments` — `id`, `member_id (fk, nullable)`, `stripe_session_id`, `stripe_event_id (unique)`, `slug`, `product_name`, `amount_cents`, `currency`, `mode (payment|subscription)`, `credential_level`, `exam_mode`, `status`, `created_at`
- `ceu_providers` — `id`, `member_id (fk)`, `status (pending|approved)`, `renews_at` (only if CEU-provider flow is in scope; else defer)
- `contact_messages` — `id`, `name`, `email`, `phone`, `message`, `created_at` (if no Resend key)

If any table/column is absent, create an **additive** migration in `supabase/migrations/` and log it. Never drop or rename admin-owned columns.

## Build Steps
1. **Auth:** Supabase email magic-link (or email+password if the admin panel already uses it — match it). Routes: `/login`, `/logout`, callback handler. Use `@supabase/ssr` for cookie-based sessions in the App Router.
2. **Middleware:** protect the `(portal)` route group; unauthenticated users → `/login?next=…`.
3. **Account page** `/account`:
   - Member profile (name, email, phone) — editable, writes to `members`.
   - **Credential status** cards: level, status badge (active/pending/expired), `expires_at`, days remaining. Pull from `credentials`.
   - **Renew** button on each credential → deep-links to the matching renewal product in `/store` with `member_id` prefilled.
   - **Payment history** table from `payments` (date, product, amount, status).
   - **Certification Sync** toggle reflecting `sync_enabled`; link to manage the subscription (Stripe billing portal session via a `/api/stripe/portal` route).
4. **Header auth state:** show "My Account" + "Logout" when authed, "Login" when not (wire the stub from `instructions/03`).
5. **Checkout ↔ member tie-in:** when an authenticated member checks out, pass `member_id` and `client_reference_id` so the webhook (`instructions/05`) can attribute the `payments` row and apply credential side effects to the right member. Guest checkout allowed → `member_id` null, reconcile by email later (log this path).
6. **Contact form** `/contact` → `app/api/contact/route.ts`: if `RESEND_API_KEY` set, email `abcac@abcac.org`; else insert into `contact_messages`. Server-side validation; success/error states matching the old site's messages ("Thank you for contacting us. We will get back to you as soon as possible." / "Oops, there was an error sending your message. Please try again later.").
7. **Stripe billing portal** `/api/stripe/portal`: create a billing-portal session for the logged-in customer (for managing the Sync / annual subscriptions).

## Constraints
- RLS: members can read/update only their own `members`, `credentials`, `payments` rows. The webhook uses the **service role key** server-side and bypasses RLS intentionally — keep that key server-only.
- Match the admin panel's auth method; do not introduce a second auth system.
- All schema changes additive + logged; coordinate field names with the admin track.
- Never expose the service role key to the client bundle.

## Done when
- A member can log in, see their credential status + payment history, and toggle Sync.
- An authenticated checkout produces a `payments` row attributed to that `member_id`, and a renewal flips the credential to `active` with a fresh `expires_at`.
- The contact form persists/sends and shows the correct success message.
- RLS verified: a member cannot read another member's rows.
- Any schema additions are migrations in `supabase/migrations/`, listed in `DECISIONS.md`.
