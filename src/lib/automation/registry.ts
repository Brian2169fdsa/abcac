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
