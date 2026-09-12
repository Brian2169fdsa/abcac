"use server";

import { revalidatePath } from "next/cache";
import { pushTaskToClickUp } from "@/lib/clickup";
import { requireUserId } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { buildCertSyncPlan, type CertSyncPlan } from "@/lib/cert-sync";

export type CertificationSyncInput = {
  id?: string | null;
  status: "draft" | "submitted";
  submissionMode: "digital" | "paper";
  fullName: string;
  phone: string;
  /** Ids of the member's OWN active `certifications` rows to synchronize. The
   *  server re-fetches these and computes the plan itself — nothing about the
   *  credential type/number/date, the target date, or the fee is trusted from
   *  the client. */
  certificationIds: string[];
  signatureName: string;
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
};

export type CertificationSyncResult =
  | { ok: true; id: string; status: "draft" | "submitted"; plan: CertSyncPlan | null }
  | { ok: false; error: string };

function clean(value: string, max = 200) {
  return value.trim().slice(0, max);
}

export async function saveCertificationSync(input: CertificationSyncInput): Promise<CertificationSyncResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const submissionMode = input.submissionMode === "paper" ? "paper" : "digital";
  const fullName = clean(input.fullName);
  const signatureName = clean(input.signatureName);
  const certificationIds = Array.from(new Set((input.certificationIds ?? []).slice(0, 6).map((id) => clean(id, 60))));

  let plan: CertSyncPlan | null = null;
  if (submissionMode === "digital" && certificationIds.length > 0) {
    // Authoritative: read the member's OWN certifications fresh from the
    // database and compute the plan server-side — the client never supplies
    // a credential type, number, expiration date, month count, or fee.
    const { data: certs } = await admin
      .from("certifications")
      .select("id,cert_type,cert_number,expiration_date,status")
      .eq("member_id", memberId)
      .in("id", certificationIds);
    const result = buildCertSyncPlan(certs ?? []);
    if (result.ok) plan = result.plan;
    else if (input.status === "submitted") return { ok: false, error: result.error };
  }

  if (input.status === "submitted") {
    if (!fullName) return { ok: false, error: "Enter your full legal name." };
    if (submissionMode === "digital") {
      if (!plan) return { ok: false, error: "Select at least two of your active certifications to synchronize." };
      if (!signatureName) return { ok: false, error: "Type your full name to sign the request." };
    }
    if (submissionMode === "paper" && !input.paperDocumentPath) return { ok: false, error: "Upload your completed paper form." };
  }

  const details = {
    version: 2,
    requestKind: "certification_sync",
    submissionMode,
    fullName,
    phone: clean(input.phone, 40),
    plan,
    paperDocumentPath: input.paperDocumentPath || null,
    paperFileName: input.paperFileName || null,
  };

  let previousStatus: string | null = null;
  if (input.id) {
    const { data: existing } = await admin.from("applications").select("id,status").eq("id", input.id).eq("member_id", memberId).eq("app_type", "cert_sync").maybeSingle();
    if (!existing) return { ok: false, error: "Certification Sync request not found." };
    previousStatus = existing.status ?? null;
    if (!["draft", "submitted"].includes(previousStatus ?? "")) return { ok: false, error: "This request is already being reviewed." };
  }

  const credentialLabel = plan?.items.map((item) => item.certType).filter(Boolean).join(", ") || "Multiple credentials";
  const row = {
    member_id: memberId,
    app_type: "cert_sync",
    cert_type: credentialLabel,
    status: input.status,
    submitted_at: input.status === "submitted" ? new Date().toISOString() : null,
    member_notes: JSON.stringify(details),
    attested: input.status === "submitted" && submissionMode === "digital",
    attested_at: input.status === "submitted" && submissionMode === "digital" ? new Date().toISOString() : null,
    signature_name: submissionMode === "digital" ? signatureName || null : null,
  };

  const query = input.id
    ? admin.from("applications").update(row).eq("id", input.id).eq("member_id", memberId).select("id").single()
    : admin.from("applications").insert(row).select("id").single();
  const { data, error } = await query;
  if (error || !data?.id) return { ok: false, error: error?.message || "Unable to save your request." };

  if (input.status === "submitted" && previousStatus !== "submitted") {
    const summary = plan
      ? `${plan.items.length} credential(s) synchronizing to ${plan.targetExpiration}; ${plan.totalMonths} month(s) total; expected payment $${(plan.totalFeeCents / 100).toFixed(2)}; ${submissionMode} submission.`
      : `${submissionMode} submission.`;
    await admin.from("member_tasks").insert({
      member_id: memberId,
      title: "Review certification sync request",
      detail: `Application ${data.id}. ${summary}`,
      priority: "high",
      status: "open",
      visible_to_member: false,
    });
    void pushTaskToClickUp({
      title: "Review certification sync request",
      detail: summary,
      priority: "high",
      adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/applications`,
    });
  }

  revalidatePath("/account/certification-sync");
  revalidatePath("/account/applications");
  revalidatePath("/admin/applications");
  return { ok: true, id: data.id, status: input.status, plan };
}
