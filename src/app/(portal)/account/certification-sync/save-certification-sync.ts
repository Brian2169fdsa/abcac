"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SyncCredentialInput = {
  type: string;
  number: string;
  expirationDate: string;
};

export type CertificationSyncInput = {
  id?: string | null;
  status: "draft" | "submitted";
  submissionMode: "digital" | "paper";
  fullName: string;
  phone: string;
  credentials: SyncCredentialInput[];
  monthsForward: number;
  targetExpirationDate: string;
  signatureName: string;
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
};

export type CertificationSyncResult =
  | { ok: true; id: string; status: "draft" | "submitted" }
  | { ok: false; error: string };

function clean(value: string, max = 200) {
  return value.trim().slice(0, max);
}

export async function saveCertificationSync(input: CertificationSyncInput): Promise<CertificationSyncResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const submissionMode = input.submissionMode === "paper" ? "paper" : "digital";
  const credentials = (input.credentials ?? []).slice(0, 6).map((credential) => ({
    type: clean(credential.type, 40),
    number: clean(credential.number, 80),
    expirationDate: clean(credential.expirationDate, 10),
  }));
  const monthsForward = Math.max(1, Math.min(120, Math.trunc(Number(input.monthsForward) || 1)));
  const fullName = clean(input.fullName);
  const signatureName = clean(input.signatureName);

  if (input.status === "submitted") {
    if (!fullName) return { ok: false, error: "Enter your full legal name." };
    if (submissionMode === "digital" && (credentials.length < 2 || credentials.some((credential) => !credential.type || !credential.number || !credential.expirationDate))) {
      return { ok: false, error: "Enter at least two complete certification records." };
    }
    if (submissionMode === "digital" && !signatureName) return { ok: false, error: "Type your full name to sign the request." };
    if (submissionMode === "paper" && !input.paperDocumentPath) return { ok: false, error: "Upload your completed paper form." };
  }

  const details = {
    version: 1,
    requestKind: "certification_sync",
    submissionMode,
    fullName,
    phone: clean(input.phone, 40),
    credentials,
    monthsForward,
    targetExpirationDate: clean(input.targetExpirationDate, 10),
    totalAmountCents: monthsForward * 1500,
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

  const row = {
    member_id: memberId,
    app_type: "cert_sync",
    cert_type: credentials.map((credential) => credential.type).filter(Boolean).join(", ") || "Multiple credentials",
    status: input.status,
    submitted_at: input.status === "submitted" ? new Date().toISOString() : undefined,
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
    await admin.from("member_tasks").insert({
      member_id: memberId,
      title: "Review certification sync request",
      detail: `Application ${data.id}. ${credentials.length} credentials; ${monthsForward} month(s) forward; expected payment $${(monthsForward * 15).toFixed(2)}; ${submissionMode} submission.`,
      priority: "high",
      status: "open",
      visible_to_member: true,
    });
  }

  revalidatePath("/account/certification-sync");
  revalidatePath("/account/applications");
  revalidatePath("/admin/applications");
  return { ok: true, id: data.id, status: input.status };
}
