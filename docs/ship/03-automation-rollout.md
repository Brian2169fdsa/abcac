# 03 — Automation Engine Rollout

The automation engine (`src/lib/automation/*`, admin UI under `/admin/automation/*`) is **built and
shipped OFF** — 16 workflow modules exist but are disabled. This is by design: the engine is
fail-closed and inert until an admin enables a workflow in the config console.

**Key launch decision:** *do you launch with automation OFF, or turn on the safe deterministic
workflows first?* You can launch the platform fully with automation off — nothing depends on it.

---

## Current engine state (verified in code)

- **Fail-closed whitelist** — `registry.ts` refuses any non-whitelisted handler.
- **Atomic approval claim** — `dispatch.ts:executeApprovedRun` claims the row
  (`UPDATE … WHERE id=? AND status='pending_approval'`) before executing, so double-click / two-admin
  double-execution is prevented. (This was the top red-team bug; it's fixed.)
- **`assertRunnable` + global pause** — `config.ts` gates execution on the kill switch + per-workflow
  `enabled` flag.
- **Vision parser never throws** — failures return low-confidence results, forcing escalation.
- **Tiering safe under bad input** — `NaN`/negative confidence → escalate; any anomaly → escalate.
- **16 workflow modules** — account-approval, certificate-issuance, ceu-review,
  credential-verification, doc-request, dunning, inbox-faq, inbox-member, invoice-generation,
  name-change, payment-reconciliation, print-request, reciprocity, refund-void, cert-sync.

---

## Before enabling ANY workflow — verify these guards (audit called them H3/M1/M3)

The atomic-claim (H1) and pause re-check (H2) are done. Confirm the remaining execute-path guards are
present (or add them) before turning anything on:

- [ ] **H3 — entity/member arg cross-check.** Assert staged-action args
  (`args.memberId`, `args.<entityId>`) match `automation_runs.member_id` / `entity_id` before
  executing; reject + flag on mismatch. Prevents a prompt-injected document from proposing an action
  on the *wrong* member.
- [ ] **M1 — execute-time state re-read.** Executors re-read current entity state and no-op/flag if it
  already moved (e.g. a CEU an admin already decided).
- [ ] **M3 — paid-guard on certificate issuance.** Auto-issuance must check `payments`/`invoices` paid
  before issuing, or it could grant free credentials. (Human issuance via `/admin/members` is fine.)
- [ ] Tests for each: claim race, paused-approve rejected, arg-mismatch rejected, unpaid-issue rejected.

---

## Phased enablement (only if you choose to turn automation on)

Enable **one workflow at a time**, watch the daily digest ~48h, then advance. Money, appeals,
revocation, and disciplinary actions stay **permanent human-escalate**.

**Phase 1 — Deterministic wins (zero model risk).** Wire `dispatch()` into the real submission paths,
then enable in the config console one at a time:
`credential_verification` → `payment_reconciliation` → `invoice_generation` → `reminders` (bring the
already-live reminder path under the engine) → `certificate_issuance` (**with the M3 paid-guard**) →
`dunning` → `doc_request`.

**Phase 2 — Agent, low-stakes.** `inbox_faq` auto-reply (no member data), incomplete-application doc
requests, needs-attention pre-triage summaries (no auto-execute).

**Phase 3 — Agent, propose-and-approve.** Vision-backed `ceu_review`, `account_approval`,
`name_change` (ID match), member-specific inbox drafts. The admin queue becomes approve-clicks.

**Phase 4 — Tune.** Pull ~2 weeks of `automation_runs`; promote propose-bands that admins approve
~100% of the time into auto by raising the config threshold. Repeat. **`reciprocity` and any
revocation/appeal/disciplinary action stay escalate forever.**

---

## Recommendation

Launch with automation **OFF** (Phase 0). It removes an entire risk surface from the launch and
nothing depends on it. Once the platform is live and stable and the H3/M1/M3 guards + tests are in,
begin Phase 1 with `credential_verification` and `payment_reconciliation` (the two lowest-risk,
fully deterministic ones) and advance on the digest.
