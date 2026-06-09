"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

// Member-detail billing + review actions — closes parity gaps B6 (invoice
// admin controls), B7 (application review fields) and B8 (document deletion).
// These are MANUAL operations only: no Stripe is ever called. Every action
// RE-CHECKS the caller's portal_role server-side on the cookie-bound session
// (the client boolean is only a UI hint and is NEVER trusted for authz).
// Mirrors cockpit-actions.ts / task-actions.ts: requireCaller() → isAdminRole
// gate → createSupabaseAdminClient() write → admin_audit_log → revalidatePath.

type ActionResult = { ok: true } | { ok: false; error: string };

const MEMBER_PAGE = (memberId: string) => `/admin/members/${memberId}`;

const INVOICE_STATUSES = ["paid", "unpaid", "void"] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const DOCUMENTS_BUCKET = "member-documents";

/** Re-read the caller from the cookie session. Returns the user id + role. */
async function requireCaller(): Promise<
  | { ok: true; userId: string; role: string | null }
  | { ok: false; error: string }
> {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  return { ok: true, userId: user.id, role: profile?.portal_role ?? null };
}

/**
 * Set an invoice's status to a MANUAL state (paid | unpaid | void). ADMIN-GATED.
 * Stamps `paid_at` when moving to "paid" and clears it otherwise so the member's
 * billing view stays consistent. Scoped by id AND member_id. No Stripe involved.
 */
export async function setInvoiceStatus(
  memberId: string,
  id: string,
  status: string,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };
  if (!INVOICE_STATUSES.includes(status as InvoiceStatus)) {
    return { ok: false, error: "bad_request" };
  }

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "invoice_status_changed",
      target_table: "invoices",
      target_id: id,
      details: { member_id: memberId, status },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

type InvoiceFields = {
  amount?: number | null;
  description?: string | null;
};

/**
 * Edit an invoice's amount and/or description. ADMIN-GATED. `amount` is dollars
 * and is stored as integer cents. Only provided fields are patched; a non-empty
 * patch is required. Scoped by id AND member_id.
 */
export async function updateInvoice(
  memberId: string,
  id: string,
  fields: InvoiceFields,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const patch: { amount_cents?: number; description?: string } = {};
  if (fields.amount !== undefined && fields.amount !== null) {
    const amount = Number(fields.amount);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "bad_request" };
    patch.amount_cents = Math.round(amount * 100);
  }
  if (fields.description !== undefined && fields.description !== null) {
    const description = String(fields.description).trim();
    if (!description) return { ok: false, error: "bad_request" };
    patch.description = description;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "invoice_updated",
      target_table: "invoices",
      target_id: id,
      details: { member_id: memberId, ...patch },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

type ApplicationReview = {
  admin_notes?: string | null;
  est_completion?: string | null;
};

/**
 * Set an application's review fields — `admin_notes` and `est_completion` (the
 * ETA the member sees). ADMIN-GATED. Complements app-status-control.tsx which
 * sets only the status. Stamps `reviewed_at`. Scoped by id AND member_id.
 */
export async function setApplicationReview(
  memberId: string,
  id: string,
  review: ApplicationReview,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin_notes = (review.admin_notes ?? "").trim() || null;
  const est = (review.est_completion ?? "").trim();
  const est_completion = est === "" ? null : est;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("applications")
    .update({ admin_notes, est_completion, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "application_reviewed",
      target_table: "applications",
      target_id: id,
      details: { member_id: memberId, admin_notes, est_completion },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}

/**
 * Delete a document row (scoped by id AND member_id) and best-effort remove the
 * underlying storage object from the `member-documents` bucket. ADMIN-GATED.
 * The row deletion is authoritative — a storage-removal failure does not fail
 * the action.
 */
export async function deleteDocument(
  memberId: string,
  id: string,
): Promise<ActionResult> {
  if (!memberId || !id) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();

  // Look up the storage path before deleting the row so we can clean up the object.
  let filePath: string | null = null;
  try {
    const { data } = await admin
      .from("documents")
      .select("file_path")
      .eq("id", id)
      .eq("member_id", memberId)
      .maybeSingle();
    filePath = (data as { file_path?: string | null } | null)?.file_path ?? null;
  } catch {
    /* best-effort lookup */
  }

  const { error } = await admin
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("member_id", memberId);
  if (error) return { ok: false, error: error.message };

  // Best-effort storage cleanup — never fails the action.
  if (filePath) {
    try {
      await admin.storage?.from(DOCUMENTS_BUCKET).remove([filePath]);
    } catch {
      /* best-effort */
    }
  }

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "document_deleted",
      target_table: "documents",
      target_id: id,
      details: { member_id: memberId, file_path: filePath },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(MEMBER_PAGE(memberId));
  return { ok: true };
}
