// ABCAC — staged-action REGISTRY (the automation safety primitive).
//
// The decision engine never performs a free-form write. An auto/propose action
// is a { handler, args } pair whose `handler` MUST be a key here. Each executor
// is a single, vetted service-role write that mirrors exactly what a human admin
// handler would do — same effect, captured before/after for the audit trail.
// The DB guard triggers permit service_role, so these run with system authority;
// adding a new automated capability means adding a reviewed executor here, never
// widening what the model can touch.
//
// Phase 0 ships a representative starter set; more executors are added as each
// workflow is enabled (Phase 1+). Unknown handlers fail closed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/lib/site-config";

export interface ExecResult {
  ok: boolean;
  error?: string;
  before?: unknown;
  after?: unknown;
}

export type Executor = (admin: SupabaseClient, args: Record<string, unknown>) => Promise<ExecResult>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * H3 — cross-check staged-action args against the run's authoritative
 * member/entity before any write. Args originate from a rule/agent (and in the
 * vision path can be steered by document/model output), so a whitelisted write
 * must still be aimed at the SAME row the run is about. Returns an anomaly
 * reason on mismatch, or `null` when the args are consistent. Missing values on
 * either side are not treated as a mismatch (nothing to contradict).
 */
export type RunContext = { memberId?: string | null; entityId?: string | null };

const ENTITY_ID_KEYS = ["entityId", "ceuId", "applicationId", "id"] as const;

export function crossCheckArgs(args: Record<string, unknown>, ctx: RunContext): string | null {
  const ctxMember = str(ctx.memberId);
  const argMember = str(args.memberId);
  if (ctxMember && argMember && argMember !== ctxMember) return "member_mismatch";

  const ctxEntity = str(ctx.entityId);
  if (ctxEntity) {
    for (const key of ENTITY_ID_KEYS) {
      const argEntity = str(args[key]);
      if (argEntity) {
        if (argEntity !== ctxEntity) return "entity_mismatch";
        break; // first present entity-id arg is authoritative
      }
    }
  }
  return null;
}

async function setCeuStatus(admin: SupabaseClient, args: Record<string, unknown>, status: string): Promise<ExecResult> {
  const id = str(args.ceuId ?? args.id);
  if (!id) return { ok: false, error: "missing_ceu_id" };
  const { data: before } = await admin.from("ceu_records").select("id,status").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "not_found" };
  const current = (before as { status?: string | null }).status ?? null;
  // M1 — re-validate entity state at execute time. If the row already reached
  // the target state, no-op (idempotent). If an `expectStatus` precondition was
  // staged and the row has since moved, refuse rather than overwrite a human's
  // intervening change.
  if (current === status) return { ok: true, before, after: { id, status }, error: undefined };
  const expect = str(args.expectStatus ?? args.fromStatus);
  if (expect && current !== expect) return { ok: false, error: "state_moved", before };
  const { error } = await admin
    .from("ceu_records")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, before, after: { id, status } };
}

export const REGISTRY: Record<string, Executor> = {
  approve_ceu: (admin, args) => setCeuStatus(admin, args, "approved"),
  reject_ceu: (admin, args) => setCeuStatus(admin, args, "rejected"),

  request_document: async (admin, args) => {
    const memberId = str(args.memberId);
    const documentType = str(args.documentType);
    if (!memberId || !documentType) return { ok: false, error: "bad_args" };
    const { data, error } = await admin
      .from("document_requests")
      .insert({ member_id: memberId, document_type: documentType, note: str(args.note), status: "open" })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, after: { id: (data as { id?: string } | null)?.id, documentType } };
  },

  send_member_message: async (admin, args) => {
    const memberId = str(args.memberId);
    const subject = str(args.subject);
    if (!memberId || !subject) return { ok: false, error: "bad_args" };
    const { error } = await admin.from("messages").insert({
      member_id: memberId,
      from_name: "ABCAC",
      subject,
      body: str(args.body),
      is_read: false,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, after: { memberId, subject } };
  },

  set_verification_result: async (admin, args) => {
    const id = str(args.id ?? args.verificationId);
    const result = str(args.result);
    if (!id || (result !== "verified" && result !== "not_verified")) return { ok: false, error: "bad_args" };
    const { data: before } = await admin
      .from("verification_requests")
      .select("id,status")
      .eq("id", id)
      .maybeSingle();
    if (!before) return { ok: false, error: "not_found" };
    // M1 — only act on a still-pending request; never overwrite a human decision.
    const cur = (before as { status?: string | null }).status ?? null;
    if (cur && cur !== "pending") return { ok: false, error: "state_moved", before };
    const now = new Date().toISOString();
    const status = result === "verified" ? "completed" : "rejected";
    const { data: row, error } = await admin
      .from("verification_requests")
      .update({ verification_result: result, verified_at: now, completed_at: now, status })
      .eq("id", id)
      .eq("status", "pending") // guard: lose the race rather than double-decide
      .select("requester_email,recipient_email,requester_name,recipient_name,subject_name,subject_cert_number")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row) return { ok: false, error: "state_moved", before };
    // Best-effort outcome email to the requester (graceful without a key).
    await notifyVerificationOutcome(row as VerificationRow, result).catch(() => {});
    return { ok: true, before, after: { id, result, status } };
  },

  set_application_status: async (admin, args) => {
    const id = str(args.applicationId ?? args.id);
    const status = str(args.status);
    if (!id || !status) return { ok: false, error: "bad_args" };
    const { data: before } = await admin.from("applications").select("id,status").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "not_found" };
    const current = (before as { status?: string | null }).status ?? null;
    // M1 — re-validate at execute time (see setCeuStatus).
    if (current === status) return { ok: true, before, after: { id, status } };
    const expect = str(args.expectStatus ?? args.fromStatus);
    if (expect && current !== expect) return { ok: false, error: "state_moved", before };
    const { error } = await admin
      .from("applications")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, before, after: { id, status } };
  },
};

export function isWhitelisted(handler: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, handler);
}

// ── Verification outcome email (mirrors the admin one-click decision email) ──

interface VerificationRow {
  requester_email?: string | null;
  recipient_email?: string | null;
  requester_name?: string | null;
  recipient_name?: string | null;
  subject_name?: string | null;
  subject_cert_number?: string | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** Best-effort Resend email of a verification outcome. No-op without a key. */
async function notifyVerificationOutcome(row: VerificationRow, result: "verified" | "not_verified"): Promise<void> {
  const to = row.requester_email || row.recipient_email || null;
  const resendKey = process.env.RESEND_API_KEY;
  if (!to || !resendKey) return;
  const name = row.requester_name || row.recipient_name || "there";
  const subjectLine = row.subject_name || row.subject_cert_number || "the requested certification";
  const verified = result === "verified";
  const outcome = verified
    ? `We can confirm that <strong>${esc(subjectLine)}</strong> holds a valid ${esc(siteConfig.shortName)} certification in good standing.`
    : `We are unable to verify a valid ${esc(siteConfig.shortName)} certification for <strong>${esc(subjectLine)}</strong> based on the information provided.`;
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">${esc(siteConfig.shortName)} Certification Verification</h2>
  <p>Hi ${esc(name)},</p>
  <p>${outcome}</p>
  ${row.subject_cert_number ? `<p style="color:#6b7280">Certification number: ${esc(row.subject_cert_number)}</p>` : ""}
  <p style="color:#6b7280;font-size:14px">If you have questions, contact us at
     <a href="${esc(siteConfig.contact.emailHref)}">${esc(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${esc(siteConfig.shortName)} &mdash; ${esc(siteConfig.name)}</p>
</div>`.trim();
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>",
      to,
      subject: verified
        ? `${siteConfig.shortName} certification verified`
        : `${siteConfig.shortName} certification verification result`,
      html,
    }),
  });
}
