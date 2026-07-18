"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/current-user";
import { sendEmail } from "@/lib/email";
import { getFormDefinition, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";
import type { DigitalApplicationDetails, DigitalFormDocument, FormAnnotation } from "@/lib/digital-form-types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SaveDigitalApplicationInput = {
  id?: string | null;
  workflowKey: string;
  submissionMode: "digital" | "paper";
  status: "draft" | "submitted";
  documents: DigitalFormDocument[];
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
};

export type ActionResult = { ok: true; id: string; message?: string; shareUrl?: string } | { ok: false; error: string };

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function sanitizeAnnotations(value: FormAnnotation[]) {
  return (value ?? []).slice(0, 800).map((annotation) => ({
    id: clean(annotation.id, 80),
    page: Math.max(1, Math.trunc(Number(annotation.page) || 1)),
    x: Math.max(0, Math.min(1, Number(annotation.x) || 0)),
    y: Math.max(0, Math.min(1, Number(annotation.y) || 0)),
    value: clean(annotation.value, 2000),
    type: ["text", "check", "date", "signature"].includes(annotation.type) ? annotation.type : "text",
    author: annotation.author === "signer" ? "signer" : "applicant",
  })) as FormAnnotation[];
}

export async function saveDigitalApplication(input: SaveDigitalApplicationInput): Promise<ActionResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const workflow = getFormWorkflow(clean(input.workflowKey, 80));
  if (!workflow) return { ok: false, error: "Select a valid ABCAC form workflow." };
  const allowedKeys = new Set(getWorkflowForms(workflow).map((form) => form.key));

  const documents = (input.documents ?? [])
    .filter((document) => allowedKeys.has(document.formKey))
    .map((document) => ({ formKey: document.formKey, annotations: sanitizeAnnotations(document.annotations) }));
  const submissionMode = input.submissionMode === "paper" ? "paper" : "digital";
  if (input.status === "submitted" && submissionMode === "digital" && !documents.some((document) => document.annotations.length > 0)) {
    return { ok: false, error: "Complete the digital packet before submitting it." };
  }
  if (input.status === "submitted" && submissionMode === "paper" && !input.paperDocumentPath) {
    return { ok: false, error: "Upload your completed paper packet before submitting it." };
  }

  const details: DigitalApplicationDetails = {
    version: 1,
    requestKind: "digital_application_packet",
    submissionMode,
    workflowKey: workflow.key,
    workflowTitle: workflow.title,
    credential: workflow.certType,
    documents,
    paperDocumentPath: input.paperDocumentPath || null,
    paperFileName: input.paperFileName || null,
  };

  let previousStatus: string | null = null;
  if (input.id) {
    const { data: existing } = await admin.from("applications").select("id,status").eq("id", input.id).eq("member_id", memberId).eq("app_type", workflow.appType).maybeSingle();
    if (!existing) return { ok: false, error: "Application draft not found." };
    previousStatus = existing.status;
    if (!["draft", "submitted"].includes(existing.status)) return { ok: false, error: "This application is already being reviewed." };
    if (existing.status === "submitted") return { ok: false, error: "This packet has already been submitted. Contact ABCAC if a correction is required." };
  }

  const row = {
    member_id: memberId,
    app_type: workflow.appType,
    cert_type: workflow.certType,
    status: input.status,
    submitted_at: input.status === "submitted" ? new Date().toISOString() : undefined,
    member_notes: JSON.stringify(details),
    attested: input.status === "submitted" && submissionMode === "digital",
    attested_at: input.status === "submitted" && submissionMode === "digital" ? new Date().toISOString() : null,
    signature_name: documents.flatMap((document) => document.annotations).find((annotation) => annotation.type === "signature" && annotation.author === "applicant")?.value || null,
  };
  const query = input.id
    ? admin.from("applications").update(row).eq("id", input.id).eq("member_id", memberId).select("id").single()
    : admin.from("applications").insert(row).select("id").single();
  const { data, error } = await query;
  if (error || !data?.id) return { ok: false, error: error?.message || "Unable to save the application." };

  if (input.status === "submitted" && previousStatus !== "submitted") {
    await admin.from("member_tasks").insert({
      member_id: memberId,
      title: `Review ${workflow.title}`,
      detail: `${submissionMode === "digital" ? "Digital" : "Uploaded paper"} packet ${data.id} submitted for admin review.`,
      priority: "high",
      status: "open",
      visible_to_member: true,
    });
  }

  revalidatePath(`/account/forms?workflow=${encodeURIComponent(workflow.key)}`);
  revalidatePath("/account/applications");
  revalidatePath("/admin/applications");
  return { ok: true, id: data.id };
}

export async function inviteApplicationSigner(input: {
  applicationId: string;
  formKey: string;
  signerRole: string;
  signerName: string;
  signerEmail: string;
}): Promise<ActionResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const { data: application } = await admin.from("applications").select("id,status,member_notes").eq("id", input.applicationId).eq("member_id", memberId).maybeSingle();
  if (!application || !["draft", "submitted"].includes(application.status)) return { ok: false, error: "Save the application before inviting a signer." };
  let applicationFormKeys: string[] = [];
  try {
    const details = JSON.parse(application.member_notes ?? "{}") as Partial<DigitalApplicationDetails>;
    applicationFormKeys = details.requestKind === "digital_application_packet" ? (details.documents ?? []).map((document) => document.formKey) : [];
  } catch { /* Invalid legacy notes cannot receive a digital signer request. */ }
  if (!getFormDefinition(input.formKey) || !applicationFormKeys.includes(input.formKey)) return { ok: false, error: "Choose a form from this application packet." };
  const signerName = clean(input.signerName, 160);
  const signerEmail = clean(input.signerEmail, 240).toLowerCase();
  const signerRole = clean(input.signerRole, 120);
  if (!signerName || !signerRole || !/^\S+@\S+\.\S+$/.test(signerEmail)) return { ok: false, error: "Enter the signer's name, role, and email." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await admin.from("application_signer_requests").insert({
    application_id: application.id,
    member_id: memberId,
    form_key: input.formKey,
    signer_role: signerRole,
    signer_name: signerName,
    signer_email: signerEmail,
    token_hash: tokenHash,
  }).select("id").single();
  if (error || !data?.id) return { ok: false, error: error?.message || "Unable to create the signer request." };

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const shareUrl = `${origin}/sign/application/${token}`;
  const sent = await sendEmail({
    to: signerEmail,
    subject: `ABCAC ${signerRole} form request`,
    html: `<p>Hello ${escapeHtml(signerName)},</p><p>An ABCAC applicant has asked you to complete and sign a portion of an application packet as <strong>${escapeHtml(signerRole)}</strong>.</p><p><a href="${shareUrl}">Open the secure form request</a></p><p>This private link is intended only for you.</p>`,
  });
  revalidatePath("/account/forms");
  return { ok: true, id: data.id, shareUrl, message: sent ? "Invitation emailed." : "Invitation created. Copy the secure link to the signer." };
}
