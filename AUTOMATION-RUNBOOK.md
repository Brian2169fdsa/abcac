# ABCAC Automation — Operations Runbook

How the automation decision engine works, what each workflow does, how to turn
things on safely, and what to do when something looks wrong. Companion to the
code in `src/lib/automation/` and the admin console at `/admin/automation`.

---

## 1. Architecture in one page

```
trigger (sweep / event) ──► dispatch(workflow, entity)
                              │
                              ├─ global pause?  workflow enabled?  ──► skip (recorded nowhere)
                              │
                              ├─ 1) DETERMINISTIC RULE (TS + Postgres, zero-model)
                              │     decisive+auto  ──► execute via REGISTRY ──► audit log
                              │     decisive+escalate ─► Needs-Attention queue
                              │
                              └─ 2) AGENT EVAL (Claude) when the rule is silent
                                    confidence ≥ auto-threshold     ──► execute via REGISTRY
                                    confidence ≥ propose-threshold  ──► pending_approval (human click)
                                    otherwise / anomalies           ──► escalate
```

Safety invariants (enforced in code, not convention):

- **Whitelist-only writes** — an automated action is a `{handler, args}` pair
  whose handler MUST exist in `registry.ts`. Unknown handlers fail closed.
  Models never compose SQL or touch tables directly.
- **H1 claim-before-execute** — approving a proposal atomically claims the run
  row; two admins double-clicking cannot double-execute.
- **H2 kill switches cover approvals** — a proposal staged before a pause or
  disable will NOT fire on approval.
- **H3 arg cross-check** — a staged write must target the same member/entity
  the run is about; mismatch fails the run.
- **M1 re-validation at execute time** — executors re-read the row; if a human
  already moved it, the executor refuses (`state_moved`) instead of overwriting.
- **Audit everything** — every run lands in `automation_runs`; every execution
  also writes `admin_audit_log` with actor_type system/agent, before/after
  payloads, rule or model version, and confidence.

## 2. Workflow inventory

| Workflow | Type | Action when enabled | Status |
|---|---|---|---|
| `credential_verification` | deterministic | auto-answer verification requests from cert records | **built** |
| `ceu_review` | deterministic (vision later) | auto-approve clean CEUs, escalate the rest | **built** |
| `dunning` | deterministic | payment reminder for invoices unpaid > 14 days | **built** |
| `invoice_generation` | deterministic | renewal invoice for certs expiring ≤ 60 days | **built** |
| `doc_request` | deterministic | request the missing required doc on in-review applications | **built** |
| `payment_reconciliation` | deterministic | match completed payments → mark invoice paid | **in progress** |
| `certificate_issuance` | deterministic + paid-guard | extend renewed certs 2 yrs; initial issuance escalates | **in progress** |
| `reciprocity` | escalate-only | permanent human gate — never automated | **in progress** |
| `refund_void` | escalate-only | permanent human gate — never automated | **in progress** |
| `account_approval` | agent (Claude) | approve clean member accounts; never auto-rejects | **in progress** |
| `name_change` | agent (Claude) | apply simple name changes (propose-capped) | **in progress** |
| `cert_sync`, `print_request`, `reminders`, `inbox_faq`, `inbox_member` | — | — | not yet built |

Everything ships **disabled** (`automation_config.enabled = false`). A workflow
with no evaluator that gets dispatched simply escalates (`no_evaluator`).

## 3. Triggers

- **Daily sweep** — `/api/cron/reminders` (Vercel cron, 14:00 UTC) runs
  `runAutomationSweep()` after the reminder pass. Each scan is skipped unless
  its workflow is enabled, so disabled workflows cost nothing.
- **On-demand sweep** — `GET /api/cron/automation-sweep` with
  `Authorization: Bearer $CRON_SECRET`, or the **Run sweep now** button in the
  admin console (admin-authed, no secret needed).
- **Daily digest** — `/api/cron/automation-digest` (13:00 UTC) emails a summary
  of runs/queue to admins.

> **Deployment prerequisite:** `CRON_SECRET` must be set in Vercel for the cron
> routes to run at all (they fail closed with 503 until then).

## 4. Enabling a workflow (the safe order)

1. Confirm the global pause is OFF and thresholds look right in
   `/admin/automation/config`.
2. Enable ONE workflow. Prefer this order: `credential_verification` →
   `doc_request` → `dunning` → `invoice_generation` → `payment_reconciliation`
   → `ceu_review` → `certificate_issuance` → agent workflows last.
3. Press **Run sweep now** and watch the run history: every row should be
   `auto_executed` with a sensible summary, or a justified escalation.
4. Spot-check 2–3 affected members (did the invoice/message/request appear
   exactly once?).
5. Leave it running for a daily cycle before enabling the next one.

Rollback: toggle the workflow off (stops new runs AND blocks approval of
already-staged proposals), or flip the global pause to stop everything.

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sweep returns `{paused: true}` | global pause on | `/admin/automation/config` |
| Workflow shows `skipped: disabled` | per-workflow toggle off | enable it (see §4) |
| Run status `failed`, error `state_moved` | a human changed the row between staging and execution — by design | nothing; review the row |
| `arg_mismatch:*` | staged args pointed at a different member/entity than the run | investigate the rule; this is the H3 guard firing |
| `handler_not_whitelisted:*` | a rule staged an unknown handler | code bug — fix the rule; nothing executed |
| Escalation `no_evaluator` | workflow enabled but no rule/agent registered | expected for unbuilt workflows; disable it |
| Agent workflows always escalate | `ANTHROPIC_API_KEY` unset | set the key in Vercel; deterministic workflows are unaffected |
| Nothing runs daily | `CRON_SECRET` unset in Vercel | set it; verify with the on-demand route |

## 6. Adding a new workflow (developer checklist)

1. Module in `src/lib/automation/workflows/<name>.ts` — exported rule (and/or
   agent) + `RULE_VERSION` + tunable constants.
2. New write? Add a vetted executor to `registry.ts` (before/after capture,
   idempotent, `state_moved` guard). Never widen an existing executor.
3. Register in `workflows/index.ts`; scan-triggered? add a `sweepX` + `SCANS`
   entry in `sweep.ts`.
4. Tests: rule paths, executor idempotency/state-moved, sweep dispatch+dedup
   (pattern: `tests/automation-workflows-batch2.test.ts`).
5. Ship disabled. Enable via §4 only after verifying on real data.
