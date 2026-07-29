# Public Site to Member Portal Funnel

Verified: July 29, 2026

## Objective

The public website remains the complete education and discovery surface for ABCAC. Every operational action that creates a certification, renewal, testing, reciprocity, CEU, synchronization, document, or payment record continues through the protected member portal.

No public content is removed. Existing ABCAC information is preserved and organized into a safer transaction sequence:

1. Learn on the public website.
2. Choose the correct service or credential.
3. Sign in or create an ABCAC account.
4. Complete and save the required form or request.
5. Submit the record and supporting documents.
6. Pay through the Stripe checkout linked to that exact record.
7. Track staff review, messages, receipts, and status in the portal.

## Verified Reference Content

The implementation was compared with the current public ABCAC pages:

- `https://www.abcac.org/`
- `https://www.abcac.org/initial-certification`
- `https://www.abcac.org/certification-renewal`
- `https://www.abcac.org/newpage`
- `https://www.abcac.org/reciprocity`

The new site retains the live site’s credential descriptions, forms, testing guidance, fee context, CEU information, IC&RC information, reciprocity guidance, contact information, and frequently asked questions while replacing disconnected forms and payment links with account-linked workflows.

## Route and Record Matrix

| Public intent | Public route | Protected destination | Required record before payment |
| --- | --- | --- | --- |
| Initial certification | `/initial-certification` | `/account/forms?workflow=initial:{credential}` | Submitted `applications` row containing the complete digital or paper packet |
| Certification renewal | `/certification-renewal` | `/account/forms?workflow=renewal:{track}` | Submitted renewal `applications` row |
| IC&RC exam testing | `/testing` or `/remote-or-inperson` | `/account/testing` | `testing_requests` row in `awaiting_payment` |
| Certification synchronization | `/certification-sync` | `/account/certification-sync` | Submitted `applications` row with `app_type=cert_sync` |
| Reciprocity transfer | `/reciprocity` | `/account/requests` | Member-owned `reciprocity_requests` row |
| CEU workshop endorsement | `/ceu` | `/account/forms?workflow=ceu:workshop` | Submitted CEU workshop `applications` row |
| CEU provider annual fee | `/ceu` | `/account/payments?product=annual-credential-fee-approved-ceu-providers` | Authenticated `payment_submissions` intake record |
| Printed certificate copy | `/store/printed-certificate-copy` | `/account/payments?product=printed-certificate-copy` | Authenticated `payment_submissions` intake record |
| Board application | `/board-application` | `/account/forms?workflow=board:member` | Saved board application; no payment required |

## Implemented Guardrails

- `/portal` is the single public gateway for account creation and sign-in.
- The requested internal destination is preserved through signup, login, and the authentication callback.
- External or malformed return paths are rejected.
- Public product pages no longer create anonymous Stripe sessions.
- Initial, renewal, and CEU workshop payments require a submitted, member-owned application of the correct type.
- Testing, reciprocity, and synchronization payments require their dedicated member-owned workflow record.
- Every checkout first creates a `payment_submissions` record that identifies the member, product, form type, and linked workflow record.
- Stripe metadata carries the payment submission and workflow identifiers into the webhook.
- Cancelled and successful Stripe checkouts return members to the exact application, testing, reciprocity, synchronization, or payments workspace that owns the charge.
- The webhook updates portal and admin records, creates operational work, sends the member receipt/confirmation, and notifies `abcac@abcac.org`.
- Draft digital forms remain resumable and support paper upload, exact form packets, typed fields, checkboxes, electronic signatures, and outside signer requests where the source form requires them.

## Launch-Critical Configuration

The code path is ready only when all of the following are true:

1. `src/data/stripe-price-map.live.json` contains the production Stripe price IDs for every enabled catalog product.
2. Production Stripe credentials and the verified webhook signing secret are configured.
3. The Stripe webhook endpoint is registered for successful and failed checkout/payment events.
4. Resend is configured with a verified ABCAC sending domain and production API key.
5. All database migrations, including the payment-submission and digital-form migrations, are deployed.
6. Supabase authentication callback URLs include the production domain.
7. `PORTAL_PREVIEW_GATE_ENABLED=false` and `PORTAL_ACCOUNT_APPROVAL_REQUIRED=false` for the public launch unless ABCAC intentionally chooses a controlled pilot.
8. The production domain, SSL, canonical URL, sitemap, robots file, and analytics configuration are verified.

## Go/No-Go Smoke Test

Run each workflow with a new member account:

1. Start from the relevant public page.
2. Create an account and confirm the intended portal route is restored.
3. Save a draft, sign out, sign back in, and confirm the draft remains.
4. Complete required forms, documents, attestations, and outside signatures.
5. Confirm payment is blocked before submission.
6. Submit the workflow and complete a Stripe test payment.
7. Confirm the payment is attached to the exact workflow in the member portal and admin console.
8. Confirm the member receives email and portal notifications.
9. Confirm `abcac@abcac.org` receives the operational payment notification.
10. Confirm staff can update the workflow and the member sees the status change.

Do not launch payments if the live price map is empty, the webhook is unverified, or any payment can be completed without an account-linked intake or workflow record.
