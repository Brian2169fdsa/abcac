# ABCAC Member Portal — Feature Status

> PHX Creative Works, 2026-09-12. Companion to `MEMBER-PORTAL-ASSESSMENT-2026-09.md`. Reflects branch
> `claude/tender-allen-fr2r8i` after the quick-win pass and the forms-workspace fix.
>
> Status key: **Working** = a member can use it end to end today (test mode where money is involved).
> **Gaps** = usable, with a specific defect or missing state noted. **Not working** = the feature does not
> deliver what it promises. **Config** = code is complete; it is inert until an owner setting is made.
> Efforts are developer-days for one engineer unless marked as an owner or ABCAC action.

Owner configuration that several rows depend on (unchanged since July): Stripe webhook endpoint and
signing secret; live Stripe seed (`stripe-price-map.live.json` is empty); Resend API key and verified
abcac.org domain; `CRON_SECRET`; Supabase Auth redirect allow-list for the production callback;
`ANTHROPIC_API_KEY`; DNS cutover. Migrations 046 and 047 must be applied to the live database.

---

## Getting in

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Sign up | Form with name, email, phone, cert status, cert numbers, terms consent; profile created by DB trigger; destination preserved through confirmation | Yes | Every new account is created `pending`; with the approval flag off (the shipped default) nothing routes them to onboarding and they are excluded from staff broadcasts while using the whole portal | Decide posture: flag on for a controlled pilot, or default new accounts to approved. 1–2 h code after the decision |
| Sign in | Email + password, `next` preserved, error messages | Yes | — | — |
| Forgot / reset password | Reset email, callback exchange, set new password; callback now reports expired or wrong-device links with guidance (fixed this pass) | Yes | Supabase links are bound to the browser that requested them (PKCE). Opening on another device still fails, now with an explanation | Owner: add production `/auth/callback` to the Supabase redirect allow-list. Optional: switch Supabase email templates to token-hash links so cross-device works (handled by the callback already). 1 h |
| Public gateway `/portal` | Routes to sign in or sign up, keeps destination | Yes | — | — |
| Approval gate + onboarding | Middleware gate, onboarding form with cert numbers, staff approval queue, legacy-roster match pill | Yes, when the flag is on | With the flag off it is unreachable; with it on, pending members see a full sidebar that bounces them back. No in-app notification on approval | Same posture decision as sign up. Hide sidebar for pending members and add an approval notification: 0.5 d |
| Legacy member first login | 283 accounts pre-provisioned and approved; "Forgot password" path | Yes | Invite-mode script links cannot be consumed by the callback | Run the campaign as create-only plus password reset (already the documented path). Runbook note: 1 h |

## Dashboard

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Welcome banner, KPI tiles, next-steps plan, insights panel, task rail, staff tasks, action items, profile meter, quick actions, activity, credential cards, sync status, payment history | All on real data; schedule-aware renewal dates; CEU compliance from `cert_schedules` | Yes | Two overlapping activity feeds and a very long page; CEU tile falls back to 40 hours when no schedule matches | Cosmetic consolidation 0.5 d. Schedule accuracy depends on the CCS/CPRS answer below |

## Profile and settings

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Edit contact details | Phone, DOB, SSN last 4, address; names locked for approved accounts with a link to Name Change (fixed this pass) | Yes | — | — |
| Change password | Yes | Yes | — | — |
| Notification preferences | Four toggles, honored by reminders and broadcasts | Yes | — | — |
| Directory opt-out | Server action, feeds public directory and verify | Yes | — | — |
| Data export | JSON of profile, certifications, CEUs, documents, applications, payments, invoices | Yes | Omits employment, supervision, other credentials, messages, requests, notifications, preferences; includes internal review notes and Stripe id | 0.25 d |

## Credentials

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Certificate & wallet card | Per-credential cards; generated certificate PDF and wallet-card PDF for active credentials; admin-uploaded scan via signed URL | Yes | PDFs have no seal or logo, a blank signature line, and no verification URL or QR to `/verify` | 0.5–1 d polish |
| Credential appears after approval | Staff issue a certification row from the member cockpit | Yes, manually | Approving an application does not create the credential; nothing links the two; automation sweep type mismatch fixed this pass | One-click "issue certificate" from the application review, admin side: 0.5–1 d |
| Other credentials from outside boards | Add with supporting document | Yes | — | — |
| IC&RC International Certificate | Email-to-request button (fixed this pass; the old button went nowhere) | Yes | Not purchasable online | Add a product and request form if ABCAC wants it online: 2 h |

## Applying and renewing

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Certification hub | Initial vs recertification, then credential | Yes | Copy says every credential renews on 40 CE hours; the official CCS and CPRS packets in the repo say 6 | ABCAC confirms; then copy, schema intro, and `cert_schedules` seed made per-credential: 0.5 d |
| Digital application workspace | All 15 ABCAC forms as native online forms; draft save and resume; required-field gating; per-form confirmation; submit; paper-packet upload alternative; loads the packet at any status, read-only once submitted with stage banner and reviewer note (fixed this pass) | Yes | Three overlapping entry points (`/account/certification`, the `/account/forms` landing, `/account/apply`) | Collapse to one entry: 2–3 h |
| Outside signers | Email invitation, private link with hashed 256-bit token, 30-day expiry, signer annotations merged in admin review | Yes, without an account | Expired or invalid link shows a bare 404; no revoke or resend; signer sees the whole form, not just their section; nobody is notified when they sign; applicant's own signature lines can be assigned to a signer. Invitation email is inert until Resend (a copyable link is shown as fallback) | 1–1.5 d |
| Pay the linked fee | Deep link from workspace and Application Status; application must be submitted and owned; checkout metadata whitelisted and webhook member-scoped (fixed this pass); fee links shown only while outstanding | Yes, test mode | Live mode returns 503 for every product because the live price map is empty | Owner: run the live seed, commit the map, swap keys, register the live webhook. 1 h |
| Application Status | Timeline, fee status, documents count, estimated completion, staff notes; "Continue application" and "View packet" links; draft state (fixed this pass) | Yes | Fee-paid fallback for rows without a payment record uses substring matching | Populate `payments.application_id` from the webhook and drop the heuristic: 0.5 d |
| Renewals page | Due date, grace period, CEU readiness per credential | Yes | Readiness computed against the soonest-expiring credential only | Per-credential readiness: 0.5 d |
| Board member application | Digital packet workflow, no fee | Yes | A second public intake on the website posts to the inbox with unstored attachments | Retire one path: 2 h |
| Testing accommodations request | Digital packet workflow | Yes | Not linked to the exam registration it belongs to; staff correlate by hand | Foreign key plus link from the testing page: 0.5 d |

## Continuing education

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Log CEUs | Course, provider, hours, category, date, certificate upload | Yes | No edit or delete of a pending entry | 0.5 d |
| Compliance tracker | Total, Ethics, Cultural Diversity against the credential's schedule; only approved hours count | Yes | Applicants with no credential are told they need 40 hours; rejection reason (`admin_notes`) never shown; members could self-approve until migration 046 is applied live | Apply 046 (owner). Applicant state and notes: 0.5 d |

## Exams

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Exam pre-registration | Exam, mode, tester and purchaser details, credential add-on, accommodations, documents; pay; statuses through pre-registered; staff decision comes back as status, message, and email | Yes, test mode | Member page hides staff notes, accommodations status, uploaded documents, and amount paid; prices hand-typed in three places | 0.5 d |

## Certification Sync

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Sync request and payment | Member types credentials, picks months forward, sees months × $15, uploads form, pays; staff task created | Yes, as a paid manual request | It never moves an expiration date. Nothing in the codebase applies the sync; staff flip a flag and edit dates by hand. Member re-types credentials the portal already holds | Either reword it honestly as a paid request (1 h) or build it: compute months from the member's `certifications`, staff approval applies the new dates, receipt reflects it. 2–3 d |

## Requests

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Name change | Form with ID upload; approval writes first, middle, last name to the profile (middle name fixed this pass) | Yes | Member sees only a status chip; denial reason not shown; no in-app notification | 0.25 d (part of the notifications item below) |
| Verification of certification | Form naming the recipient; staff record verified or not | Submit works | No letter or artifact is produced; the outcome email goes to the third party, never the member; member sees only "completed" | Letter PDF stored and downloadable, member email, notification: 1–2 d |
| Reciprocity transfer | In or out; $150 outbound fee paid in portal; webhook marks paid (member-scoped, fixed this pass) | Yes, test mode | Staff notes not shown to the member | 0.25 d |

## Documents

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Upload documents | Private per-member folder, typed against the application checklist, 10 MB and PDF/JPG/PNG check | Yes | Validation is by filename extension only, no server-side size or type limit; no member delete; members could set their own status until 046 is applied | Apply 046 (owner). Delete for pending uploads and bucket limits: 0.5 d |
| Staff-requested documents | Open requests listed, "Upload this" pre-selects type, auto-fulfils on match, notification on request | Yes | — | — |

## Employment and supervision

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Employment history | Add and edit | Yes | No delete | 2 h |
| Clinical supervision | Add relationship, link supervisee by email, both sides see it | Yes | No edit or end date; sidebar label "Clinical Supervision" is fine but the page never shows staff-recorded authorizations | 0.5 d |

## Money

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Payments page | Catalog with application fees gated behind a submitted application | Yes, test mode | Live blocked by the empty price map | Owner seed, see above |
| Stripe Checkout and webhook | Portal-only, ownership validated, payment recorded first with duplicate protection, unpaid sessions skipped, failures return 500 for retry, expired sessions close the intake record (all fixed this pass) | Yes, test mode | Refunds, disputes, and subscription cancellation are still not reflected; webhook endpoint not yet registered in Stripe for production | Owner: register the endpoint and secret. Refund and subscription events: 1 d |
| Invoices | Staff-issued invoices with Pay Now, void invoices excluded and not payable, post-payment banner (fixed this pass); payment history; printable receipts | Yes | Receipt is a print-to-PDF popup using the raw Stripe session id as the receipt number; invoice numbers are time-based | Server-side receipt with Stripe reference and payer: 1 d |
| CEU provider annual subscription | $500/year Stripe subscription, renewals recorded | Charge works | Member has no way to cancel or update the card; the Stripe Customer Portal route exists but is unlinked and the customer id is never stored for one-time payers | Store customer id at checkout and link the Customer Portal from Invoices: 0.5 d |

## Communication

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Messages | Two-way thread with staff, mark-read, unread badge (badge fixed this pass) | Yes | Refresh-only, no live updates | Optional realtime: 1 d |
| In-app notifications | Bell, full page with filters, mark read; generated for invoices, document requests, staff tasks, staff messages, payments, exam updates | Yes | Nothing fires when a document, CEU, or application changes status or a request is decided | DB triggers plus copy: 0.5–1 d |
| Email | Receipts, approval notices, request decisions, signer invitations, reminders, contact form | Code complete | All email is a silent no-op until Resend is configured | Owner: Resend key and domain |
| Reminders | Daily Vercel cron: renewal 90/60/30, CEU shortfall, document requests, task due; deduplicated; in-portal message plus email; duplicate pg_cron schedule retired (047, fixed this pass) | Code complete | Not running until `CRON_SECRET` is set; email half until Resend | Owner: set the secret, apply 047 |

## Activity

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Unified timeline | Ten sources, type filters | Yes | — | — |

## AI assistant

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| "Need help?" chat | Server-side tool loop, RLS-scoped to the member, rate-limited, audited; 8 read tools and 6 write tools (log CEU, name change, verification, reciprocity, message staff, update contact details; name updates now redirected to Name Change for approved accounts) | Code complete | Returns a friendly "not enabled" until `ANTHROPIC_API_KEY` is set. Footer says "your data only" while it can take actions. Starting a reciprocity transfer via chat leaves the fee unpaid. Configured model id should be confirmed against the current model list before launch | Owner: API key. Footer copy and reciprocity checkout hand-off: 0.25 d |
| Transcript export | Emails a chat transcript | Yes | Public route that relays text to any address from the ABCAC domain, protected only by an in-memory rate limit | Gate behind a session or remove for launch: 0.25 d |

## Public pages fed by member data

| Feature | Built | Working | Not working | To finish |
|---|---|---|---|---|
| Verify a credential | Lookup by name or number, opt-out honored | Yes | — | — |
| Public directory | Filter by credential type (non-ABCAC "CADC" removed this pass), pagination | Yes | — | — |

---

## Totals

- **Working today, no action needed:** sign in, gateway, dashboard, contact edits, password, preferences, opt-out, certificate and wallet card download, other credentials, hub, digital application workspace, read-only submitted view, Application Status, renewals page, board application, CEU logging, exam registration, name change and reciprocity submission, documents and staff-requested documents, employment, supervision, invoices, messages, notifications, activity, verify, directory.
- **Working once the owner configuration is done:** every payment in live mode, all email, reminders, the AI assistant, migrations 046 and 047.
- **Not delivering what it promises:** Certification Sync (a flag, not a sync), verification requests (no letter, wrong recipient), subscription self-management.
- **Decisions needed before code can finish:** approval posture, CCS/CPRS renewal hours, fee text in the PDFs versus the catalog, whether Sync should be built or reworded.
- **Remaining engineering to close every gap above:** roughly 12 to 16 developer-days, in addition to the owner configuration.
