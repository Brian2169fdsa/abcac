import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantTool, ToolExecutor } from "./run";
import { decideVerification } from "@/app/(admin)/admin/requests/decide-verification";

/**
 * ADMIN tool definitions + executors for ABCAC staff.
 *
 * SECURITY: every WRITE executor re-checks `portal_role === 'admin'` on the
 * cookie-bound session before acting (the route already gated read access, but
 * we re-verify per-write so a privilege change mid-conversation can't be
 * exploited). Writes go through the service-role client (`admin`) mirroring the
 * existing admin components, and append a best-effort `admin_audit_log` entry.
 * The dedicated verification decision reuses the existing
 * `decideVerification` server action rather than reimplementing it.
 *
 * Admin find/get tools legitimately accept a member_id (admins see all members).
 */

export interface AdminToolContext {
  /** RLS-scoped cookie client — used for reads and the per-write admin re-check. */
  sb: SupabaseClient;
  /** Service-role client — bypasses RLS for admin writes (mirrors components). */
  admin: SupabaseClient;
  /** The admin's auth user id (audit attribution). */
  uid: string;
}

const CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];

export function getAdminTools(): AssistantTool[] {
  return [
    {
      name: "get_dashboard_counts",
      description:
        "Get the admin dashboard counts: total members, accounts awaiting approval, pending documents, pending CEUs, open applications, active credentials, and credentials expiring within 90 days.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "list_pending_approvals",
      description: "List member accounts that have been submitted and are pending approval.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "list_pending_ceus",
      description: "List CEU records pending review, with member id, course, hours, and category.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "list_pending_documents",
      description: "List documents pending review, with member id, type, and file name.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "list_pending_requests",
      description:
        "List pending requests across name-change, verification, and reciprocity tables.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "find_member",
      description:
        "Find members by name or email. Returns matching members with id, name, email, account status, and role.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Name or email to search for." } },
        required: ["query"],
      },
    },
    {
      name: "get_member_overview",
      description:
        "Get a full overview of a specific member by id: profile, certifications, CEU records, documents, and invoices.",
      input_schema: {
        type: "object",
        properties: { member_id: { type: "string", description: "The member's profile id." } },
        required: ["member_id"],
      },
    },
    {
      name: "approve_account",
      description:
        "Approve a pending member account by id. Activates their pending self-reported certifications. Confirm with the admin first.",
      input_schema: {
        type: "object",
        properties: { member_id: { type: "string" } },
        required: ["member_id"],
      },
    },
    {
      name: "reject_account",
      description: "Reject a pending member account by id with a reason. Confirm with the admin first.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          reason: { type: "string", description: "What needs to change (shared with the member)." },
        },
        required: ["member_id", "reason"],
      },
    },
    {
      name: "approve_ceu",
      description: "Approve a CEU record by id. Confirm with the admin first.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "The ceu_records row id." } },
        required: ["id"],
      },
    },
    {
      name: "reject_ceu",
      description: "Reject a CEU record by id with a reason. Confirm with the admin first.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The ceu_records row id." },
          reason: { type: "string", description: "Reason shared with the member." },
        },
        required: ["id", "reason"],
      },
    },
    {
      name: "issue_certification",
      description:
        "Issue a certification credential to a member. Confirm the member, credential type, and details with the admin first.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          type: { type: "string", enum: CREDENTIALS, description: "Credential type." },
          number: { type: "string", description: "Certificate number (optional)." },
          level: { type: "string", description: "IC&RC level (optional)." },
          issued: { type: "string", description: "Issued date YYYY-MM-DD (optional)." },
          expires: { type: "string", description: "Expiration date YYYY-MM-DD (optional)." },
        },
        required: ["member_id", "type"],
      },
    },
    {
      name: "decide_verification",
      description:
        "Decide a verification request by id: 'verified' or 'not_verified'. Emails the requester the outcome. Confirm with the admin first.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "The verification_requests row id." },
          decision: { type: "string", enum: ["verified", "not_verified"] },
        },
        required: ["id", "decision"],
      },
    },
    {
      name: "send_message_to_member",
      description: "Send an admin message to a member's inbox. Confirm subject and body first.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["member_id", "subject", "body"],
      },
    },
    {
      name: "create_invoice",
      description: "Create an unpaid invoice for a member. Confirm description and amount first.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          description: { type: "string" },
          amount_cents: { type: "number", description: "Invoice amount in cents (e.g. 15000 = $150)." },
        },
        required: ["member_id", "description", "amount_cents"],
      },
    },
  ];
}

export function getAdminExecutors(ctx: AdminToolContext): Record<string, ToolExecutor> {
  const { sb, admin, uid } = ctx;

  /** Re-verify admin role on the cookie session before every write. */
  async function assertAdmin(): Promise<void> {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error("Not signed in.");
    const { data: profile } = await sb
      .from("profiles")
      .select("portal_role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.portal_role !== "admin") throw new Error("Forbidden — admin role required.");
  }

  async function audit(action: string, table: string, targetId: string | null, details?: unknown) {
    try {
      await admin.from("admin_audit_log").insert({
        admin_id: uid,
        action,
        target_table: table,
        target_id: targetId,
        details: details ?? null,
      });
    } catch {
      /* best-effort */
    }
  }

  return {
    async get_dashboard_counts() {
      const now = new Date();
      const in90 = new Date(now.getTime() + 90 * 86_400_000);
      const count = async (table: string, build?: (q: any) => any) => {
        let q = sb.from(table).select("*", { count: "exact", head: true });
        if (build) q = build(q);
        const { count: c } = await q;
        return c ?? 0;
      };
      const [members, approvals, docs, ceus, apps, activeCerts, expiring] = await Promise.all([
        count("profiles"),
        count("profiles", (q) =>
          q.eq("account_status", "pending").not("account_submitted_at", "is", null),
        ),
        count("documents", (q) => q.eq("status", "pending")),
        count("ceu_records", (q) => q.eq("status", "pending")),
        count("applications", (q) => q.in("status", ["submitted", "under_review"])),
        count("certifications", (q) => q.eq("status", "active")),
        count("certifications", (q) =>
          q
            .eq("status", "active")
            .gte("expiration_date", now.toISOString().slice(0, 10))
            .lte("expiration_date", in90.toISOString().slice(0, 10)),
        ),
      ]);
      return JSON.stringify({
        total_members: members,
        accounts_to_approve: approvals,
        documents_pending: docs,
        ceus_pending: ceus,
        applications_open: apps,
        active_credentials: activeCerts,
        expiring_in_90_days: expiring,
      });
    },

    async list_pending_approvals() {
      const { data } = await sb
        .from("profiles")
        .select("id,first_name,last_name,email,account_submitted_at")
        .eq("account_status", "pending")
        .not("account_submitted_at", "is", null)
        .order("account_submitted_at", { ascending: true });
      return JSON.stringify({ pending_approvals: data ?? [] });
    },

    async list_pending_ceus() {
      const { data } = await sb
        .from("ceu_records")
        .select("id,member_id,course_name,provider,hours,category,completion_date")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true });
      return JSON.stringify({ pending_ceus: data ?? [] });
    },

    async list_pending_documents() {
      const { data } = await sb
        .from("documents")
        .select("id,member_id,document_type,file_name,uploaded_at")
        .eq("status", "pending")
        .order("uploaded_at", { ascending: true });
      return JSON.stringify({ pending_documents: data ?? [] });
    },

    async list_pending_requests() {
      const [{ data: nameChanges }, { data: verifications }, { data: reciprocity }] =
        await Promise.all([
          sb
            .from("name_change_requests")
            .select("id,member_id,new_name,reason,submitted_at")
            .eq("status", "pending"),
          sb
            .from("verification_requests")
            .select("id,member_id,purpose,recipient_name,requester_name,source,submitted_at")
            .eq("status", "pending"),
          sb
            .from("reciprocity_requests")
            .select("id,member_id,direction,credential,destination,submitted_at")
            .eq("status", "pending"),
        ]);
      return JSON.stringify({
        name_change_requests: nameChanges ?? [],
        verification_requests: verifications ?? [],
        reciprocity_requests: reciprocity ?? [],
      });
    },

    async find_member(input) {
      const q = String(input.query ?? "").trim();
      if (!q) throw new Error("query is required.");
      const { data } = await sb
        .from("profiles")
        .select("id,first_name,last_name,email,account_status,portal_role")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(25);
      return JSON.stringify({ members: data ?? [] });
    },

    async get_member_overview(input) {
      const memberId = String(input.member_id ?? "");
      if (!memberId) throw new Error("member_id is required.");
      const [
        { data: profile },
        { data: certs },
        { data: ceus },
        { data: docs },
        { data: invoices },
      ] = await Promise.all([
        sb.from("profiles").select("*").eq("id", memberId).maybeSingle(),
        sb.from("certifications").select("*").eq("member_id", memberId),
        sb.from("ceu_records").select("*").eq("member_id", memberId),
        sb.from("documents").select("*").eq("member_id", memberId),
        sb.from("invoices").select("*").eq("member_id", memberId),
      ]);
      return JSON.stringify({
        profile: profile ?? null,
        certifications: certs ?? [],
        ceu_records: ceus ?? [],
        documents: docs ?? [],
        invoices: invoices ?? [],
      });
    },

    async approve_account(input) {
      await assertAdmin();
      const memberId = String(input.member_id ?? "");
      if (!memberId) throw new Error("member_id is required.");
      const { error } = await admin
        .from("profiles")
        .update({
          account_status: "approved",
          account_reviewed_at: new Date().toISOString(),
          account_review_notes: null,
        })
        .eq("id", memberId);
      if (error) throw new Error(error.message);
      await admin
        .from("certifications")
        .update({ status: "active" })
        .eq("member_id", memberId)
        .eq("status", "pending");
      await audit("account_approved", "profiles", memberId);
      return "Account approved and pending certifications activated.";
    },

    async reject_account(input) {
      await assertAdmin();
      const memberId = String(input.member_id ?? "");
      const reason = String(input.reason ?? "");
      if (!memberId || !reason) throw new Error("member_id and reason are required.");
      const { error } = await admin
        .from("profiles")
        .update({
          account_status: "rejected",
          account_reviewed_at: new Date().toISOString(),
          account_review_notes: reason,
        })
        .eq("id", memberId);
      if (error) throw new Error(error.message);
      await audit("account_rejected", "profiles", memberId, { note: reason });
      return "Account rejected with the supplied reason.";
    },

    async approve_ceu(input) {
      await assertAdmin();
      const id = String(input.id ?? "");
      if (!id) throw new Error("id is required.");
      const { error } = await admin
        .from("ceu_records")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await audit("ceu_records_approved", "ceu_records", id, { status: "approved" });
      return "CEU record approved.";
    },

    async reject_ceu(input) {
      await assertAdmin();
      const id = String(input.id ?? "");
      const reason = String(input.reason ?? "");
      if (!id || !reason) throw new Error("id and reason are required.");
      const { error } = await admin
        .from("ceu_records")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          admin_notes: reason,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await audit("ceu_records_rejected", "ceu_records", id, { status: "rejected" });
      return "CEU record rejected with the supplied reason.";
    },

    async issue_certification(input) {
      await assertAdmin();
      const memberId = String(input.member_id ?? "");
      const type = String(input.type ?? "");
      if (!memberId || !type) throw new Error("member_id and type are required.");
      const { error } = await admin.from("certifications").insert({
        member_id: memberId,
        cert_type: type,
        cert_number: input.number ? String(input.number) : null,
        ic_rc_level: input.level ? String(input.level) : null,
        issued_date: input.issued ? String(input.issued) : null,
        expiration_date: input.expires ? String(input.expires) : null,
        status: "active",
      });
      if (error) throw new Error(error.message);
      await audit("certification_issued", "certifications", null, {
        member_id: memberId,
        cert_type: type,
      });
      return `Issued ${type} certification to the member.`;
    },

    async decide_verification(input) {
      await assertAdmin();
      const id = String(input.id ?? "");
      const decision = String(input.decision ?? "");
      if (decision !== "verified" && decision !== "not_verified") {
        throw new Error("decision must be 'verified' or 'not_verified'.");
      }
      // Reuse the existing admin-gated server action (it re-checks admin role,
      // writes the result, audits, and emails the requester).
      const res = await decideVerification(id, decision);
      if (!res.ok) throw new Error(res.error);
      return `Verification request marked ${decision}.`;
    },

    async send_message_to_member(input) {
      await assertAdmin();
      const memberId = String(input.member_id ?? "");
      const subject = String(input.subject ?? "");
      const body = String(input.body ?? "");
      if (!memberId || !subject) throw new Error("member_id and subject are required.");
      const { error } = await admin.from("messages").insert({
        member_id: memberId,
        from_name: "ABCAC Admin",
        subject,
        body,
        is_read: false,
      });
      if (error) throw new Error(error.message);
      await audit("message_sent", "messages", null, { member_id: memberId });
      return `Sent message "${subject}" to the member.`;
    },

    async create_invoice(input) {
      await assertAdmin();
      const memberId = String(input.member_id ?? "");
      const description = String(input.description ?? "");
      const amountCents = Math.round(Number(input.amount_cents));
      if (!memberId || !description || !(amountCents > 0)) {
        throw new Error("member_id, description, and a positive amount_cents are required.");
      }
      const invoiceNumber = "INV-" + Date.now().toString(36).toUpperCase();
      const { error } = await admin.from("invoices").insert({
        member_id: memberId,
        invoice_number: invoiceNumber,
        description,
        amount_cents: amountCents,
        status: "unpaid",
      });
      if (error) throw new Error(error.message);
      await audit("invoice_created", "invoices", null, {
        member_id: memberId,
        amount_cents: amountCents,
      });
      return `Created invoice ${invoiceNumber} for $${(amountCents / 100).toFixed(2)}.`;
    },
  };
}
