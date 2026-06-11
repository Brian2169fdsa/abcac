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

/**
 * Split a full-name string on its LAST space: everything before is given
 * name(s), the final token is the surname. With 3+ parts the middle token(s)
 * land in middle_name; with 2 parts middle_name is cleared.
 */
export function parseFullName(full: string): { first: string; middle: string | null; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: null, last: "" };
  if (parts.length === 1) return { first: parts[0], middle: null, last: "" };
  return {
    first: parts[0],
    middle: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    last: parts[parts.length - 1],
  };
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

  // Create an unpaid invoice (invoice_generation: renewal billing). Mirrors the
  // admin "new invoice" write. Idempotent — if an unpaid invoice with the same
  // description already exists for the member, no-op rather than double-billing.
  create_invoice: async (admin, args) => {
    const memberId = str(args.memberId);
    const description = str(args.description);
    const amount = typeof args.amountCents === "number" ? args.amountCents : Number(args.amountCents);
    if (!memberId || !description || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "bad_args" };
    }
    const cents = Math.round(amount);
    const { data: existing } = await admin
      .from("invoices")
      .select("id")
      .eq("member_id", memberId)
      .eq("description", description)
      .eq("status", "unpaid")
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { ok: true, before: existing, after: { id: (existing as { id?: string }).id, deduped: true } };
    }
    const invoiceNumber =
      "INV-AUTO-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data, error } = await admin
      .from("invoices")
      .insert({ member_id: memberId, invoice_number: invoiceNumber, description, amount_cents: cents, status: "unpaid" })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, after: { id: (data as { id?: string } | null)?.id, invoiceNumber, amountCents: cents } };
  },

  // Reconcile a completed payment to its invoice (payment_reconciliation).
  // Mirrors the webhook's invoice mark-paid write. Idempotent — an already-paid
  // invoice is an ok no-op; a refunded (or otherwise moved) invoice refuses with
  // state_moved rather than resurrecting it. The Stripe session id is stamped
  // into stripe_payment_intent only when that column is still empty.
  mark_invoice_paid: async (admin, args) => {
    const id = str(args.invoiceId ?? args.id);
    if (!id) return { ok: false, error: "missing_invoice_id" };
    const { data: before } = await admin
      .from("invoices")
      .select("id,status,paid_at,stripe_payment_intent")
      .eq("id", id)
      .maybeSingle();
    if (!before) return { ok: false, error: "not_found" };
    const b = before as { status?: string | null; stripe_payment_intent?: string | null };
    const current = b.status ?? null;
    // M1 — re-validate at execute time: already paid is a success no-op.
    if (current === "paid") return { ok: true, before, after: { id, status: "paid" } };
    // Refunded (or any non-unpaid state) means a human moved it — never overwrite.
    if (current !== "unpaid") return { ok: false, error: "state_moved", before };
    const patch: Record<string, unknown> = { status: "paid", paid_at: new Date().toISOString() };
    const session = str(args.stripeSessionId);
    if (session && !str(b.stripe_payment_intent)) patch.stripe_payment_intent = session;
    const { error } = await admin
      .from("invoices")
      .update(patch)
      .eq("id", id)
      .eq("status", "unpaid"); // guard: lose the race rather than double-mark
    if (error) return { ok: false, error: error.message };
    return { ok: true, before, after: { id, status: "paid", stripePaymentIntent: patch.stripe_payment_intent ?? b.stripe_payment_intent ?? null } };
  },

  // Extend an active certification to a rule-computed target expiration
  // (certificate_issuance: paid renewal). The TARGET is staged by the rule
  // (2 years from max(today, current expiration)), so a re-run is a no-op: an
  // expiration already at/past the target never gets pushed out again. A cert
  // that is no longer active means a human intervened — refuse (state_moved).
  extend_certification: async (admin, args) => {
    const id = str(args.certId ?? args.id);
    const target = str(args.targetExpiration);
    if (!id || !target || !/^\d{4}-\d{2}-\d{2}$/.test(target)) return { ok: false, error: "bad_args" };
    const targetMs = Date.parse(target);
    if (Number.isNaN(targetMs)) return { ok: false, error: "bad_args" };
    // Sanity bound on a staged date: never set an expiration > 10 years out.
    if (targetMs > Date.now() + 10 * 365.25 * 86_400_000) return { ok: false, error: "bad_args" };
    const { data: before } = await admin
      .from("certifications")
      .select("id,status,expiration_date")
      .eq("id", id)
      .maybeSingle();
    if (!before) return { ok: false, error: "not_found" };
    const b = before as { status?: string | null; expiration_date?: string | null };
    // M1 — idempotent: already at/past the staged target is a success no-op.
    const currentMs = b.expiration_date ? Date.parse(b.expiration_date) : NaN;
    if (!Number.isNaN(currentMs) && currentMs >= targetMs) {
      return { ok: true, before, after: { id, expirationDate: b.expiration_date } };
    }
    // Only extend a still-active cert; anything else moved under us.
    if ((b.status ?? null) !== "active") return { ok: false, error: "state_moved", before };
    const { error } = await admin
      .from("certifications")
      .update({ expiration_date: target, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "active"); // guard: lose the race rather than extend a moved cert
    if (error) return { ok: false, error: error.message };
    return { ok: true, before, after: { id, expirationDate: target } };
  },

  // Approve a pending member registration (account_approval). Mirrors the
  // status flip of the admin Approve button on /admin/approvals. Idempotent —
  // already-approved is an ok no-op. M1 — any OTHER status (e.g. a human
  // rejected it after staging) is `state_moved`: never overwrite a human
  // decision. Pending self-reported cert activation and the welcome/credentials
  // emails deliberately stay with the human flow for now.
  approve_account: async (admin, args) => {
    const id = str(args.memberId ?? args.id);
    if (!id) return { ok: false, error: "bad_args" };
    const { data: before } = await admin
      .from("profiles")
      .select("id,account_status")
      .eq("id", id)
      .maybeSingle();
    if (!before) return { ok: false, error: "not_found" };
    const cur = (before as { account_status?: string | null }).account_status ?? null;
    if (cur === "approved") return { ok: true, before, after: { id, account_status: "approved" } };
    if (cur !== "pending") return { ok: false, error: "state_moved", before };
    const { error } = await admin
      .from("profiles")
      .update({ account_status: "approved", account_reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("account_status", "pending"); // guard: lose the race rather than re-decide
    if (error) return { ok: false, error: error.message };
    return { ok: true, before, after: { id, account_status: "approved" } };
  },

  // Apply a name change request (name_change). Mirrors the admin decideRequest
  // approve path: mark the request 'completed' + reviewed_at, then write the
  // parsed new name back to the member's canonical profile. The new name is
  // re-read from the request row at execute time (never trusted from args).
  // Idempotent — already-completed is an ok no-op; any other non-pending status
  // (e.g. human-rejected) is `state_moved`.
  apply_name_change: async (admin, args) => {
    const id = str(args.id ?? args.requestId);
    if (!id) return { ok: false, error: "bad_args" };
    const { data: reqData } = await admin
      .from("name_change_requests")
      .select("id,member_id,new_name,status")
      .eq("id", id)
      .maybeSingle();
    if (!reqData) return { ok: false, error: "not_found" };
    const req = reqData as { id: string; member_id: string | null; new_name: string | null; status: string | null };
    if (req.status === "completed") {
      return { ok: true, before: { request: req }, after: { request: { id, status: "completed" } } };
    }
    if (req.status !== "pending") return { ok: false, error: "state_moved", before: { request: req } };
    const fullName = (req.new_name ?? "").trim();
    if (!fullName || !req.member_id) return { ok: false, error: "bad_state", before: { request: req } };

    const { data: profileBefore } = await admin
      .from("profiles")
      .select("id,first_name,middle_name,last_name")
      .eq("id", req.member_id)
      .maybeSingle();

    const { error: reqErr } = await admin
      .from("name_change_requests")
      .update({ status: "completed", reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending"); // guard: lose the race rather than re-decide
    if (reqErr) return { ok: false, error: reqErr.message };

    const name = parseFullName(fullName);
    const namePatch = { first_name: name.first, middle_name: name.middle, last_name: name.last };
    const { error: profErr } = await admin.from("profiles").update(namePatch).eq("id", req.member_id);
    if (profErr) {
      // The request was completed but the profile write failed — surface it so
      // the run is marked failed and a human reconciles.
      return { ok: false, error: `profile_update_failed:${profErr.message}`, before: { request: req, profile: profileBefore } };
    }
    return {
      ok: true,
      before: { request: req, profile: profileBefore },
      after: { request: { id, status: "completed" }, profile: { id: req.member_id, ...namePatch } },
    };
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
