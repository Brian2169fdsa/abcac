"use server";

import { createHash, randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/current-user";
import { pushTaskToClickUp } from "@/lib/clickup";
import { sendEmail } from "@/lib/email";
import { getFormDefinition, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";
import { isDigitalPacketComplete } from "@/lib/digital-form-progress";
import type { DigitalApplicationDetails, DigitalFormDocument, FormAnnotation, SmartFormField } from "@/lib/digital-form-types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type SaveDigitalApplicationInput = {
  id?: string | null;
  workflowKey: string;
  submissionMode: "digital" | "paper";
  status: "draft" | "submitted";
  documents: DigitalFormDocument[];
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
  /** testing:accommodations only — which of the member's own exam pre-registrations this request is for. */
  testingRequestId?: string | null;
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
    fieldId: annotation.fieldId ? clean(annotation.fieldId, 120) : undefined,
    page: Math.max(1, Math.trunc(Number(annotation.page) || 1)),
    x: Math.max(0, Math.min(1, Number(annotation.x) || 0)),
    y: Math.max(0, Math.min(1, Number(annotation.y) || 0)),
    width: annotation.width === undefined ? undefined : Math.max(0.01, Math.min(1, Number(annotation.width) || 0.01)),
    height: annotation.height === undefined ? undefined : Math.max(0.01, Math.min(1, Number(annotation.height) || 0.01)),
    label: annotation.label ? clean(annotation.label, 240) : undefined,
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
    .map((document) => ({
      formKey: document.formKey,
      annotations: sanitizeAnnotations(document.annotations),
      completed: document.completed === true,
      completedAt: document.completed === true ? clean(document.completedAt || new Date().toISOString(), 40) : null,
    }));
  const submissionMode = input.submissionMode === "paper" ? "paper" : "digital";
  if (input.status === "submitted" && submissionMode === "digital" && !isDigitalPacketComplete(documents, workflow.formKeys)) {
    return { ok: false, error: `Complete and confirm all ${workflow.formKeys.length} required form${workflow.formKeys.length === 1 ? "" : "s"} before submitting this packet.` };
  }
  if (input.status === "submitted" && submissionMode === "paper" && !input.paperDocumentPath) {
    return { ok: false, error: "Upload your completed paper packet before submitting it." };
  }

  // testing:accommodations only — the linked exam pre-registration must belong
  // to this member. Never trust the client's id past that ownership check.
  let testingRequestId: string | null = null;
  if (workflow.appType === "testing_accommodations" && input.testingRequestId) {
    const { data: testingRequest } = await admin
      .from("testing_requests")
      .select("id")
      .eq("id", input.testingRequestId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!testingRequest) return { ok: false, error: "Select one of your own exam pre-registrations." };
    testingRequestId = testingRequest.id;
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
    // Drafts have not been submitted — leave the timestamp null so Application
    // Status does not show a "Submitted" date on an unsent packet.
    submitted_at: input.status === "submitted" ? new Date().toISOString() : null,
    member_notes: JSON.stringify(details),
    attested: input.status === "submitted" && submissionMode === "digital",
    attested_at: input.status === "submitted" && submissionMode === "digital" ? new Date().toISOString() : null,
    signature_name: documents.flatMap((document) => document.annotations).find((annotation) => annotation.type === "signature" && annotation.author === "applicant")?.value || null,
    ...(workflow.appType === "testing_accommodations" ? { testing_request_id: testingRequestId } : {}),
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
      visible_to_member: false,
    });
    void pushTaskToClickUp({
      title: `Review ${workflow.title}`,
      detail: `${submissionMode === "digital" ? "Digital" : "Uploaded paper"} application packet submitted.`,
      priority: "high",
      adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/applications/${data.id}`,
    });
    if (workflow.key === "initial:pra") {
      const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/applications/${data.id}`;
      void sendEmail({
        to: "abcac@abcac.org",
        subject: "New Peer Recovery Associate (PR-A) application submitted",
        html: `<p>A ${submissionMode === "digital" ? "digital" : "uploaded paper"} Peer Recovery Associate (PR-A) application packet has been submitted for review.</p><p><a href="${adminUrl}">Open the application</a></p>`,
      });
    }
  }

  revalidatePath("/account/forms");
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
  signatureField?: SmartFormField | null;
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

  const field = input.signatureField;
  if (!field || field.type !== "signature" || field.page < 1) {
    return { ok: false, error: "Choose an available signature line for this signer." };
  }
  const reservedSignature: FormAnnotation = {
    id: randomUUID(),
    fieldId: clean(field.id, 120),
    page: Math.trunc(field.page),
    x: Math.max(0, Math.min(1, Number(field.x) || 0)),
    y: Math.max(0, Math.min(1, Number(field.y) || 0)),
    width: Math.max(0.01, Math.min(1, Number(field.width) || 0.1)),
    height: Math.max(0.01, Math.min(1, Number(field.height) || 0.03)),
    label: clean(field.label || "Signature", 240),
    value: "",
    type: "signature",
    author: "signer",
  };

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
    annotations: [reservedSignature],
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

/** Withdraws a not-yet-signed signer invitation, freeing its reserved signature line for a new invite. */
export async function revokeApplicationSigner(requestId: string): Promise<ActionResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from("application_signer_requests")
    .select("id,status")
    .eq("id", requestId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Signer request not found." };
  if (request.status === "signed") return { ok: false, error: "This signer has already submitted their section." };
  if (request.status !== "revoked") {
    const { error } = await admin.from("application_signer_requests").update({ status: "revoked" }).eq("id", requestId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/account/forms");
  return { ok: true, id: requestId, message: "Signer invitation withdrawn." };
}

/** Re-invites a signer with a fresh secure link and a reset 30-day expiration, and re-sends the email. */
export async function resendApplicationSigner(requestId: string): Promise<ActionResult> {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from("application_signer_requests")
    .select("id,status,signer_name,signer_email,signer_role")
    .eq("id", requestId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Signer request not found." };
  if (request.status === "signed") return { ok: false, error: "This signer has already submitted their section." };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await admin
    .from("application_signer_requests")
    .update({
      token_hash: tokenHash,
      status: "invited",
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      opened_at: null,
    })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const shareUrl = `${origin}/sign/application/${token}`;
  const sent = await sendEmail({
    to: request.signer_email,
    subject: `ABCAC ${request.signer_role} form request`,
    html: `<p>Hello ${escapeHtml(request.signer_name)},</p><p>An ABCAC applicant has asked you to complete and sign a portion of an application packet as <strong>${escapeHtml(request.signer_role)}</strong>.</p><p><a href="${shareUrl}">Open the secure form request</a></p><p>This private link is intended only for you.</p>`,
  });
  revalidatePath("/account/forms");
  return { ok: true, id: requestId, shareUrl, message: sent ? "New invitation emailed." : "New invitation created. Copy the secure link to the signer." };
}
