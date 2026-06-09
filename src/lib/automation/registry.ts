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

async function setCeuStatus(admin: SupabaseClient, args: Record<string, unknown>, status: string): Promise<ExecResult> {
  const id = str(args.ceuId ?? args.id);
  if (!id) return { ok: false, error: "missing_ceu_id" };
  const { data: before } = await admin.from("ceu_records").select("id,status").eq("id", id).maybeSingle();
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
