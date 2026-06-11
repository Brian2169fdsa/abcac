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
import { DUNNING_AGE_DAYS } from "./workflows/dunning";
import { RENEWAL_WINDOW_DAYS } from "./workflows/invoice-generation";
import { REQUIRED_DOC_BY_APP_TYPE, docAlreadyCovered } from "./workflows/doc-request";
import { PAID_PAYMENT_STATUSES } from "./workflows/payment-reconciliation";
import { ISSUANCE_APP_TYPES } from "./workflows/certificate-issuance";

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

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

export interface SweepResult {
  scanned: number;
  dispatched: number;
}

/** Dispatch every still-pending CEU record that hasn't been processed yet. */
export async function sweepCeuReview(admin: SupabaseClient, limit = 100): Promise<SweepResult> {
  const { data } = await admin
    .from("ceu_records")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "ceu_review", r.id)) continue;
    await dispatch({
      workflow: "ceu_review",
      entityType: "ceu_record",
      entityId: r.id,
      memberId: r.member_id,
    });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
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
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "dunning", r.id)) continue;
    await dispatch({ workflow: "dunning", entityType: "invoice", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
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
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "invoice_generation", r.id)) continue;
    await dispatch({ workflow: "invoice_generation", entityType: "certification", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
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
  let dispatched = 0;
  for (const r of rows) {
    const need = r.app_type ? REQUIRED_DOC_BY_APP_TYPE[r.app_type] : undefined;
    if (!need || !r.member_id) continue;
    if (await docAlreadyCovered(admin, r.member_id, need)) continue;
    if (await hasExistingRun(admin, "doc_request", r.id)) continue;
    await dispatch({ workflow: "doc_request", entityType: "application", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/** Dispatch every completed payment that still has a same-amount unpaid invoice. */
export async function sweepPaymentReconciliation(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("payments")
    .select("id, member_id, status, amount_cents")
    .in("status", PAID_PAYMENT_STATUSES)
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null; amount_cents: number | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    if (!r.member_id || typeof r.amount_cents !== "number" || r.amount_cents <= 0) continue;
    // Pre-filter: only dispatch when at least one unpaid invoice matches the amount.
    const { data: inv } = await admin
      .from("invoices")
      .select("id")
      .eq("member_id", r.member_id)
      .eq("status", "unpaid")
      .eq("amount_cents", r.amount_cents)
      .limit(1)
      .maybeSingle();
    if (!inv) continue;
    if (await hasExistingRun(admin, "payment_reconciliation", r.id)) continue;
    await dispatch({ workflow: "payment_reconciliation", entityType: "payment", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
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
  let dispatched = 0;
  for (const r of rows) {
    if (!r.member_id) continue;
    if (await hasExistingRun(admin, "certificate_issuance", r.id)) continue;
    await dispatch({ workflow: "certificate_issuance", entityType: "application", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/** Dispatch every pending reciprocity request (rule always escalates to a human). */
export async function sweepReciprocity(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("reciprocity_requests")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "reciprocity", r.id)) continue;
    await dispatch({ workflow: "reciprocity", entityType: "reciprocity_request", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/** Dispatch every submitted-and-pending registration awaiting account review. */
export async function sweepAccountApproval(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("profiles")
    .select("id, account_status, account_submitted_at")
    .eq("account_status", "pending")
    .limit(limit);
  const rows = (data as { id: string; account_submitted_at: string | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    // Signup creates the profile already in 'pending'; only ONBOARDED profiles
    // (account_submitted_at stamped) are actually awaiting review.
    if (!r.account_submitted_at) continue;
    if (await hasExistingRun(admin, "account_approval", r.id)) continue;
    await dispatch({ workflow: "account_approval", entityType: "profile", entityId: r.id, memberId: r.id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
}

/** Dispatch every still-pending name change request. */
export async function sweepNameChange(admin: SupabaseClient, limit = 200): Promise<SweepResult> {
  const { data } = await admin
    .from("name_change_requests")
    .select("id, member_id, status")
    .eq("status", "pending")
    .limit(limit);
  const rows = (data as { id: string; member_id: string | null }[] | null) ?? [];
  let dispatched = 0;
  for (const r of rows) {
    if (await hasExistingRun(admin, "name_change", r.id)) continue;
    await dispatch({ workflow: "name_change", entityType: "name_change_request", entityId: r.id, memberId: r.member_id });
    dispatched++;
  }
  return { scanned: rows.length, dispatched };
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
  // refund_void has NO sweep — it is dispatched ad hoc on refund intent, and its
  // rule always escalates (registered in workflows/index.ts, never automated).
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
