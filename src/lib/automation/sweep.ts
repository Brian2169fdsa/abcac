// ABCAC — automation SWEEP (cron-driven trigger for scan-based workflows).
//
// Some entities are created by client-side inserts (e.g. CEU submissions go
// straight to Postgres from the member form), so there's no server hook to call
// dispatch() at write time. The sweep is the uniform trigger: on a schedule it
// scans for actionable rows and hands each to dispatch(), skipping anything that
// already has an automation_runs row for that workflow (idempotent — a row is
// processed at most once). Scans are gated on the workflow being enabled, so a
// disabled workflow does no work.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowConfig, isGloballyPaused } from "./config";
import { dispatch } from "./dispatch";
import { DAY_MS, isoDate } from "./time";
import { DUNNING_AGE_DAYS } from "./workflows/dunning";
import { RENEWAL_WINDOW_DAYS } from "./workflows/invoice-generation";
import { REQUIRED_DOC_BY_APP_TYPE, docAlreadyCovered } from "./workflows/doc-request";
import { PAID_PAYMENT_STATUSES } from "./workflows/payment-reconciliation";
import { ISSUANCE_APP_TYPES } from "./workflows/certificate-issuance";
import { CERT_SYNC_APP_TYPE, CERT_SYNC_PENDING_STATUSES } from "./workflows/cert-sync";
import { INBOX_RECENT_DAYS, profileIdForEmail } from "./workflows/inbox-member";

/** True when an automation_runs row already exists for (workflow, entityId). */
export async function hasExistingRun(
  admin: SupabaseClient,
  workflow: string,
  entityId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("automation_runs")
    .select("id")
    .eq("workflow", workflow)
    .eq("entity_id", entityId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Batched run-dedup: which of these entityIds already have an automation_runs
 * row for this workflow? One `.in()` query instead of one probe per row.
 */
export async function existingRunEntityIds(
  admin: SupabaseClient,
  workflow: string,
  entityIds: string[],
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const { data } = await admin
    .from("automation_runs")
    .select("entity_id")
    .eq("workflow", workflow)
    .in("entity_id", entityIds);
  const rows = (data as { entity_id: string | null }[] | null) ?? [];
  return new Set(rows.map((r) => r.entity_id).filter((v): v is string => Boolean(v)));
}

export interface SweepResult {
  scanned: number;
  dispatched: number;
}

interface SweepRow {
  id: string;
  /** Optional — sweeps over tables without member attribution use memberIdOf. */
  member_id?: string | null;
}

/**
 * Shared sweep driver: given the already-queried candidate rows, apply any
 * per-row pre-filter, dedup against existing runs in one batched query, and
 * dispatch whatever's left. Counting matches the per-sweep loops it replaced:
 * `scanned` is the raw row count, `dispatched` only what was handed off.
 */
async function runSweep<R extends SweepRow>(
  admin: SupabaseClient,
  opts: {
    workflow: string;
    entityType: string;
    rows: R[];
    /** Optional member attribution override (defaults to row.member_id). */
    memberIdOf?: (row: R) => string | null;
    /** Return false to skip the row before the dedup check (cross-table probes live here). */
    preFilter?: (row: R) => boolean | Promise<boolean>;
  },
): Promise<SweepResult> {
  const { workflow, entityType, rows, memberIdOf, preFilter } = opts;

  const candidates: R[] = [];
  for (const r of rows) {
    if (preFilter && !(await preFilter(r))) continue;
    candidates.push(r);
  }

  const existing = await existingRunEntityIds(
    admin,
    workflow,
    candidates.map((r) => r.id),
  );

  let dispatched = 0;
  for (const r of candidates) {
    if (existing.has(r.id)) continue;
    await dispatch({
      workflow,
      entityType,
      entityId: r.id,
      memberId: memberIdOf ? memberIdOf(r) : (r.member_id ?? null),
    });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/** Dispatch every still-pending CEU record that hasn't been processed yet. */
export async function sweepCeuReview(admin: SupabaseClient, limit = 100): Promise<SweepResult> {
  const { data } = await admin
    .from("ceu_records")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, { workflow: "ceu_review", entityType: "ceu_record", rows });
}

/** Dispatch every unpaid invoice that's past the dunning grace window. */
export async function sweepDunning(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - DUNNING_AGE_DAYS * DAY_MS).toISOString();
  const { data } = await admin
    .from("invoices")
    .select("id, member_id, status, created_at")
    .eq("status", "unpaid")
    .lt("created_at", cutoff)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, { workflow: "dunning", entityType: "invoice", rows });
}

/** Dispatch every active cert expiring within the renewal window (to bill it). */
export async function sweepInvoiceGeneration(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS);
  const { data } = await admin
    .from("certifications")
    .select("id, member_id, status, expiration_date")
    .eq("status", "active")
    .gte("expiration_date", isoDate(now))
    .lte("expiration_date", isoDate(windowEnd))
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, { workflow: "invoice_generation", entityType: "certification", rows });
}

/** Dispatch every in-review application still missing its required document. */
export async function sweepDocRequest(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const appTypes = Object.keys(REQUIRED_DOC_BY_APP_TYPE);
  const { data } = await admin
    .from("applications")
    .select("id, member_id, app_type, status")
    .in("status", ["submitted", "under_review"])
    .in("app_type", appTypes)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null; app_type: string | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "doc_request",
    entityType: "application",
    rows,
    preFilter: async (r) => {
      const need = r.app_type ? REQUIRED_DOC_BY_APP_TYPE[r.app_type] : undefined;
      if (!need || !r.member_id) return false;
      return !(await docAlreadyCovered(admin, r.member_id, need));
    },
  });
}

/** Dispatch every completed payment that still has a same-amount unpaid invoice. */
export async function sweepPaymentReconciliation(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("payments")
    .select("id, member_id, status, amount_cents")
    .in("status", PAID_PAYMENT_STATUSES)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null; amount_cents: number | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "payment_reconciliation",
    entityType: "payment",
    rows,
    preFilter: async (r) => {
      if (!r.member_id || typeof r.amount_cents !== "number" || r.amount_cents <= 0) return false;
      // Pre-filter: only dispatch when at least one unpaid invoice matches the amount.
      const { data: inv } = await admin
        .from("invoices")
        .select("id")
        .eq("member_id", r.member_id)
        .eq("status", "unpaid")
        .eq("amount_cents", r.amount_cents)
        .limit(1)
        .maybeSingle();
      return Boolean(inv);
    },
  });
}

/** Dispatch every approved initial/renewal application (paid-guard is in the rule). */
export async function sweepCertificateIssuance(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("applications")
    .select("id, member_id, app_type, status")
    .eq("status", "approved")
    .in("app_type", ISSUANCE_APP_TYPES)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "certificate_issuance",
    entityType: "application",
    rows,
    preFilter: (r) => Boolean(r.member_id),
  });
}

/** Dispatch every pending reciprocity request (rule always escalates to a human). */
export async function sweepReciprocity(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("reciprocity_requests")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, { workflow: "reciprocity", entityType: "reciprocity_request", rows });
}

/** Dispatch every submitted-and-pending registration awaiting account review. */
export async function sweepAccountApproval(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("profiles")
    .select("id, account_status, account_submitted_at")
    .eq("account_status", "pending")
    .limit(limit);
  const rows = (data as { id: string; account_submitted_at: string | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "account_approval",
    entityType: "profile",
    rows,
    memberIdOf: (r) => r.id,
    // Signup creates the profile already in 'pending'; only ONBOARDED profiles
    // (account_submitted_at stamped) are actually awaiting review.
    preFilter: (r) => Boolean(r.account_submitted_at),
  });
}

/** Dispatch every still-pending name change request. */
export async function sweepNameChange(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("name_change_requests")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, { workflow: "name_change", entityType: "name_change_request", rows });
}

/** Dispatch every still-pending cert_sync application. */
export async function sweepCertSync(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("applications")
    .select("id, member_id, app_type, status")
    .in("status", CERT_SYNC_PENDING_STATUSES)
    .eq("app_type", CERT_SYNC_APP_TYPE)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "cert_sync",
    entityType: "application",
    rows,
    preFilter: (r) => Boolean(r.member_id),
  });
}

/**
 * Dispatch recent inbound MEMBER messages for triage: portal composes
 * (`messages` rows with sender_role='member' not yet read by an admin) and
 * contact-form rows whose sender email matches a member profile.
 *
 * PRECEDENCE with sweepInboxFaq: the two sweeps partition contact_messages by
 * profile-email match — member match wins and is dispatched HERE; sweepInboxFaq
 * skips those rows. A message is therefore only ever processed by one workflow.
 */
export async function sweepInboxMember(admin: SupabaseClient, limit = 100): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - INBOX_RECENT_DAYS * DAY_MS).toISOString();

  // 1) Portal messages composed by members and still unread by admins.
  const { data: portal } = await admin
    .from("messages")
    .select("id, member_id, sender_role, is_read, created_at")
    .eq("sender_role", "member")
    .eq("is_read", false)
    .gte("created_at", cutoff)
    .limit(limit);
  const portalRows = (portal as { id: string; member_id: string | null }[] | null) ?? [];
  const portalRes = await runSweep(admin, {
    workflow: "inbox_member",
    entityType: "message",
    rows: portalRows,
    preFilter: (r) => Boolean(r.member_id),
  });

  // 2) Contact-form submissions from a KNOWN member email (member match wins).
  const { data: contact } = await admin
    .from("contact_messages")
    .select("id, email, created_at")
    .gte("created_at", cutoff)
    .limit(limit);
  const contactRows = (contact as { id: string; email: string | null }[] | null) ?? [];
  // Resolve member attribution up front: rows without a profile-email match are
  // public senders — inbox_faq territory — and never reach the dedup check.
  const matched: { id: string; member_id: string }[] = [];
  for (const r of contactRows) {
    const memberId = await profileIdForEmail(admin, r.email);
    if (!memberId) continue; // public sender — inbox_faq territory
    matched.push({ id: r.id, member_id: memberId });
  }
  const contactRes = await runSweep(admin, {
    workflow: "inbox_member",
    entityType: "contact_message",
    rows: matched,
  });

  return {
    scanned: portalRows.length + contactRows.length,
    dispatched: portalRes.dispatched + contactRes.dispatched,
  };
}

/**
 * Dispatch recent PUBLIC contact-form submissions for FAQ auto-answer.
 * Skips any row whose sender email matches a member profile — those belong to
 * sweepInboxMember (precedence: member match wins), even when inbox_member is
 * currently disabled (the row stays visible to humans in /admin/inbox either
 * way; it must never get a generic public FAQ auto-reply).
 *
 * IDEMPOTENCY: contact_messages has no status/reply column, so the engine's
 * one-run-per-entity dedup (existingRunEntityIds in runSweep) is the only thing
 * preventing a second reply email — never remove it.
 */
export async function sweepInboxFaq(admin: SupabaseClient, limit = 100): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - INBOX_RECENT_DAYS * DAY_MS).toISOString();
  const { data } = await admin
    .from("contact_messages")
    .select("id, email, created_at")
    .gte("created_at", cutoff)
    .limit(limit);
  const rows = (data as { id: string; email: string | null }[] | null) ?? [];
  return runSweep(admin, {
    workflow: "inbox_faq",
    entityType: "contact_message",
    rows,
    // contact_messages has no member_id — public senders dispatch with memberId null.
    memberIdOf: () => null,
    // member match wins → inbox_member
    preFilter: async (r) => !(await profileIdForEmail(admin, r.email)),
  });
}

const SCANS: { workflow: string; run: (admin: SupabaseClient) => Promise<SweepResult> }[] = [
  { workflow: "ceu_review", run: sweepCeuReview },
  { workflow: "dunning", run: sweepDunning },
  { workflow: "invoice_generation", run: sweepInvoiceGeneration },
  { workflow: "doc_request", run: sweepDocRequest },
  { workflow: "payment_reconciliation", run: sweepPaymentReconciliation },
  { workflow: "certificate_issuance", run: sweepCertificateIssuance },
  { workflow: "reciprocity", run: sweepReciprocity },
  { workflow: "account_approval", run: sweepAccountApproval },
  { workflow: "name_change", run: sweepNameChange },
  { workflow: "cert_sync", run: sweepCertSync },
  // inbox_member is listed before inbox_faq to make the routing precedence
  // visible, though correctness doesn't depend on order: both sweeps partition
  // contact_messages by profile-email match (member match → inbox_member only).
  { workflow: "inbox_member", run: sweepInboxMember },
  { workflow: "inbox_faq", run: sweepInboxFaq },
  // refund_void has NO sweep — it is dispatched ad hoc on refund intent, and its
  // rule always escalates (registered in workflows/index.ts, never automated).
  // reminders has NO sweep either — the legacy reminder runner stays the engine;
  // the automation workflow only mirrors its sends into run history
  // (reminders-bridge.ts), so there is nothing for dispatch() to evaluate.
];

/**
 * Run all scan-based deterministic workflows. Each scan only runs when its
 * workflow is enabled (so a disabled workflow costs nothing). Honors the global
 * pause. Best-effort per workflow — one failing scan doesn't abort the others.
 */
export async function runAutomationSweep(): Promise<Record<string, unknown>> {
  const admin = createSupabaseAdminClient();
  if (await isGloballyPaused(admin)) return { paused: true };

  const out: Record<string, unknown> = {};
  for (const { workflow, run } of SCANS) {
    const cfg = await getWorkflowConfig(admin, workflow);
    if (!cfg?.enabled) {
      out[workflow] = { skipped: "disabled" };
      continue;
    }
    try {
      out[workflow] = await run(admin);
    } catch (err) {
      out[workflow] = { error: err instanceof Error ? err.message : "sweep_failed" };
    }
  }
  return out;
}
