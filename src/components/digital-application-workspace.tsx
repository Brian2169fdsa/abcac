"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, FileDown, Loader2, Send, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DigitalFormDocument, FormAnnotation, SmartFormField } from "@/lib/digital-form-types";
import type { FormDefinition } from "@/lib/form-library";
import { hasCompletedEntry, isDigitalFormComplete, isDigitalPacketComplete } from "@/lib/digital-form-progress";
import { getWorkflowFees } from "@/lib/form-library";
import { getNativeFormSchema, getNativeSignatureFields, missingRequiredNativeFields } from "@/lib/native-form-schemas";
import { DigitalPdfEditor } from "@/components/digital-pdf-editor";
import { NativeFormEditor } from "@/components/native-form-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { inviteApplicationSigner, saveDigitalApplication } from "@/app/(portal)/account/forms/actions";

type SignerRequest = { id: string; form_key: string; signer_role: string; signer_name: string; signer_email: string; status: string; signed_at: string | null; annotations?: FormAnnotation[] | null };

export function DigitalApplicationWorkspace({
  workflowKey,
  workflowTitle,
  certType,
  packet,
  applicationId: initialApplicationId,
  initialMode,
  initialStatus,
  initialDocuments,
  initialPaperPath,
  initialPaperName,
  signerRequests,
}: {
  workflowKey: string;
  workflowTitle: string;
  certType: string;
  packet: FormDefinition[];
  applicationId: string | null;
  initialMode: "digital" | "paper";
  initialStatus: string | null;
  initialDocuments: DigitalFormDocument[];
  initialPaperPath: string | null;
  initialPaperName: string | null;
  signerRequests: SignerRequest[];
}) {
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [status, setStatus] = useState(initialStatus);
  const [mode, setMode] = useState(initialMode);
  const [documents, setDocuments] = useState<DigitalFormDocument[]>(packet.map((form) => initialDocuments.find((document) => document.formKey === form.key) ?? { formKey: form.key, annotations: [] }));
  const [activeFormKey, setActiveFormKey] = useState(packet[0]?.key ?? "");
  const [signatureName, setSignatureName] = useState("");
  const [paperPath, setPaperPath] = useState(initialPaperPath);
  const [paperName, setPaperName] = useState(initialPaperName);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | "upload" | "invite" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState("Supervisor / Attestor");
  const [signerFormKey, setSignerFormKey] = useState(packet[0]?.key ?? "");
  const [signerRequestsState, setSignerRequestsState] = useState(signerRequests);
  const [detectedFields, setDetectedFields] = useState<Record<string, SmartFormField[]>>({});
  const [signatureFieldId, setSignatureFieldId] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const locked = status === "submitted";
  const activeForm = packet.find((form) => form.key === activeFormKey) ?? packet[0];
  const activeDocument = documents.find((document) => document.formKey === activeFormKey) ?? { formKey: activeFormKey, annotations: [], completed: false };
  const activeFormIndex = packet.findIndex((form) => form.key === activeFormKey);
  const completedForms = documents.filter(isDigitalFormComplete).length;
  const digitalPacketComplete = isDigitalPacketComplete(documents, packet.map((form) => form.key));
  const usedSignatureFieldIds = new Set(signerRequestsState.flatMap((request) => request.annotations ?? []).map((annotation) => annotation.fieldId).filter(Boolean));
  const activeNativeSchema = activeForm ? getNativeFormSchema(activeForm.key) : undefined;
  const availableSignatureFields = (detectedFields[signerFormKey] ?? []).filter((field) => field.type === "signature" && !usedSignatureFieldIds.has(field.id));

  // Native (HTML) forms know their signature fields up front — no PDF scan needed.
  useEffect(() => {
    setDetectedFields((current) => {
      const seeded = { ...current };
      let changed = false;
      for (const form of packet) {
        const schema = getNativeFormSchema(form.key);
        if (schema && !seeded[form.key]?.length) {
          seeded[form.key] = getNativeSignatureFields(schema);
          changed = true;
        }
      }
      return changed ? seeded : current;
    });
  }, [packet]);

  useEffect(() => {
    if (!availableSignatureFields.some((field) => field.id === signatureFieldId)) {
      setSignatureFieldId(availableSignatureFields[0]?.id ?? "");
    }
  }, [availableSignatureFields, signatureFieldId]);

  function setActiveAnnotations(annotations: DigitalFormDocument["annotations"]) {
    setDocuments((current) => current.map((document) => document.formKey === activeFormKey ? { ...document, annotations, completed: false, completedAt: null } : document));
  }

  function toggleActiveFormComplete() {
    if (!hasCompletedEntry(activeDocument)) {
      setError("Fill at least one field in this form before marking your section complete.");
      return;
    }
    if (activeNativeSchema && !isDigitalFormComplete(activeDocument)) {
      const missing = missingRequiredNativeFields(activeNativeSchema, activeDocument.annotations);
      if (missing.length) {
        setError(`Complete the required fields before confirming this form: ${missing.slice(0, 5).join("; ")}${missing.length > 5 ? ` — and ${missing.length - 5} more` : ""}.`);
        return;
      }
    }
    setError(null);
    const completed = !isDigitalFormComplete(activeDocument);
    setDocuments((current) => current.map((document) => document.formKey === activeFormKey ? { ...document, completed, completedAt: completed ? new Date().toISOString() : null } : document));
    if (completed && activeFormIndex >= 0 && activeFormIndex < packet.length - 1) setActiveFormKey(packet[activeFormIndex + 1].key);
  }

  async function uploadPaper() {
    if (!paperFile) return;
    setBusy("upload"); setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in again."); setBusy(null); return; }
    const path = `${user.id}/applications/${Date.now()}_${paperFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("member-documents").upload(path, paperFile);
    if (uploadError) { setError(uploadError.message); setBusy(null); return; }
    await supabase.from("documents").insert({ member_id: user.id, document_type: `${workflowTitle} Paper Packet`, related_cert: certType, file_name: paperFile.name, file_path: path, file_size_kb: Math.round(paperFile.size / 1024), status: "pending" });
    setPaperPath(path); setPaperName(paperFile.name); setMessage("Paper packet uploaded. Save or submit when ready."); setBusy(null);
  }

  async function save(status: "draft" | "submitted") {
    setBusy(status === "draft" ? "save" : "submit"); setError(null); setMessage(null);
    const result = await saveDigitalApplication({ id: applicationId, workflowKey, submissionMode: mode, status, documents, paperDocumentPath: paperPath, paperFileName: paperName });
    if (!result.ok) setError(result.error);
    else { setApplicationId(result.id); setStatus(status); setMessage(status === "draft" ? "Draft saved. You can safely leave and return later." : "Application submitted to ABCAC for review."); }
    setBusy(null);
  }

  async function inviteSigner() {
    setError(null); setMessage(null); setShareUrl(null);
    let savedId = applicationId;
    if (!savedId) {
      const saved = await saveDigitalApplication({ workflowKey, submissionMode: "digital", status: "draft", documents });
      if (!saved.ok) { setError(saved.error); return; }
      savedId = saved.id; setApplicationId(saved.id);
    }
    const signatureField = availableSignatureFields.find((field) => field.id === signatureFieldId);
    if (!signatureField) { setError("Open this form and choose an available signature line before inviting the signer."); return; }
    setBusy("invite");
    const result = await inviteApplicationSigner({ applicationId: savedId, formKey: signerFormKey, signerRole, signerName, signerEmail, signatureField });
    if (!result.ok) setError(result.error);
    else {
      setMessage(result.message ?? "Signer invited.");
      setShareUrl(result.shareUrl ?? null);
      setSignerRequestsState((current) => [...current, { id: result.id, form_key: signerFormKey, signer_role: signerRole, signer_name: signerName, signer_email: signerEmail, status: "pending", signed_at: null, annotations: [{ id: result.id, fieldId: signatureField.id, page: signatureField.page, x: signatureField.x, y: signatureField.y, width: signatureField.width, height: signatureField.height, label: signatureField.label, value: "", type: "signature", author: "signer" }] }]);
      setSignerName(""); setSignerEmail("");
    }
    setBusy(null);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">{workflowTitle}</p><h2 className="mt-1 text-2xl">Choose how you want to complete your packet</h2></div>
          <div className="flex rounded-full border border-line bg-bg p-1"><button type="button" onClick={() => setMode("digital")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "digital" ? "bg-brand text-white" : "text-muted"}`}>Digital form</button><button type="button" onClick={() => setMode("paper")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "paper" ? "bg-brand text-white" : "text-muted"}`}>Paper upload</button></div>
        </div>
      </div>

      {mode === "digital" ? (
        <>
          <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.07] via-surface to-info/[0.05] p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Your required application packet</p><h2 className="mt-1 text-2xl">Complete every form below</h2><p className="mt-2 max-w-2xl text-sm text-muted">This application has {packet.length} required {packet.length === 1 ? "form" : "forms"}. We keep them together, save your progress, and guide you from one to the next.</p></div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">{completedForms} of {packet.length} confirmed</div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {packet.map((form, index) => {
                const document = documents.find((item) => item.formKey === form.key) ?? { formKey: form.key, annotations: [] };
                const complete = isDigitalFormComplete(document);
                const active = activeFormKey === form.key;
                return <button key={form.key} type="button" onClick={() => setActiveFormKey(form.key)} className={`rounded-xl border p-4 text-left transition ${active ? "border-info bg-white shadow-md ring-2 ring-info/10" : "border-line bg-white/70 hover:border-brand/30 hover:bg-white"}`}>
                  <div className="flex items-start gap-3">{complete ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" /> : <Circle className="mt-0.5 h-6 w-6 shrink-0 text-muted/50" />}<div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Part {index + 1} of {packet.length} · Required</p><h3 className="mt-1 text-base">{form.shortTitle}</h3><p className="mt-1 text-xs text-muted">{form.pages} pages · {document.annotations.length} fields entered</p><p className={`mt-2 text-xs font-semibold ${complete ? "text-success" : active ? "text-info" : "text-brand"}`}>{complete ? "Your section is confirmed" : active ? "Currently working here" : "Still needs your attention"}</p></div></div>
                </button>;
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Required part {activeFormIndex + 1} of {packet.length}</p><h2 className="mt-1 text-xl">{activeForm?.title}</h2><p className="mt-1 text-sm text-muted">{activeNativeSchema ? "This is the digital version of the ABCAC form — every field is a real input. Your work saves to this packet." : "Complete your portion directly on the original ABCAC form. Your work saves to this packet."}</p></div><span className="rounded-full bg-bg px-3 py-1.5 text-xs font-semibold text-muted">{activeDocument.annotations.filter((annotation) => annotation.value.trim()).length} fields entered</span></div>
            {activeForm && (activeNativeSchema
              ? <NativeFormEditor schema={activeNativeSchema} annotations={activeDocument.annotations} onChange={setActiveAnnotations} signatureName={signatureName} onSignatureNameChange={setSignatureName} readOnly={locked} />
              : <DigitalPdfEditor form={activeForm} annotations={activeDocument.annotations} onChange={setActiveAnnotations} signatureName={signatureName} onSignatureNameChange={setSignatureName} onFieldsDetected={(fields) => setDetectedFields((current) => ({ ...current, [activeForm.key]: fields }))} readOnly={locked} />)}
            {!locked && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg p-4"><div><p className="text-sm font-semibold">Finished your portion of this form?</p><p className="mt-1 text-xs text-muted">Confirm it here. You can reopen it before submitting the full packet.</p></div><Button type="button" variant={isDigitalFormComplete(activeDocument) ? "outline" : "primary"} onClick={toggleActiveFormComplete}>{isDigitalFormComplete(activeDocument) ? "Reopen this form" : <>Confirm this form <ArrowRight className="h-4 w-4" /></>}</Button></div>}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-line bg-surface p-5"><h3>Need someone else to complete or sign a section?</h3><p className="mt-2 text-sm text-muted">Invite a supervisor, evaluator, colleague, or attestor. Their private form opens with the selected signature space already prepared.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={signerName} onChange={(event) => setSignerName(event.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-sm" placeholder="Signer name" /><input value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-sm" placeholder="Signer email" type="email" /><input value={signerRole} onChange={(event) => setSignerRole(event.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-sm" placeholder="Role" /><select value={signerFormKey} onChange={(event) => { setSignerFormKey(event.target.value); setActiveFormKey(event.target.value); }} className="h-11 rounded-lg border border-line bg-bg px-3 text-sm">{packet.map((form) => <option key={form.key} value={form.key}>{form.shortTitle}</option>)}</select><select value={signatureFieldId} onChange={(event) => setSignatureFieldId(event.target.value)} className="h-11 rounded-lg border border-line bg-bg px-3 text-sm sm:col-span-2" disabled={!availableSignatureFields.length}><option value="">{availableSignatureFields.length ? "Choose signature space" : "No unassigned signature spaces found"}</option>{availableSignatureFields.map((field, index) => <option key={field.id} value={field.id}>Signature space {index + 1} · page {field.page} · {field.label}</option>)}</select></div><Button type="button" className="mt-4" onClick={inviteSigner} disabled={busy !== null || !signatureFieldId}>{busy === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Invite signer</Button>{shareUrl && <div className="mt-4 rounded-lg bg-bg p-3 text-xs"><p className="font-semibold">Secure signer link</p><p className="mt-1 break-all text-muted">{shareUrl}</p></div>}</div>
            <div className="rounded-2xl border border-line bg-surface p-5"><h3>Signer status</h3><div className="mt-3 space-y-3">{signerRequestsState.length ? signerRequestsState.map((request) => <div key={request.id} className="rounded-lg border border-line p-3 text-sm"><div className="font-semibold">{request.signer_name} · {request.signer_role}</div><div className="text-muted">{request.signer_email} · {request.status}</div><div className="mt-1 text-xs text-muted">{request.annotations?.find((annotation) => annotation.type === "signature")?.label ?? "Signature space reserved"}</div></div>) : <p className="text-sm text-muted">No outside signers invited yet.</p>}</div></div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-6"><h2>Complete the original packet on paper</h2><p className="mt-2 text-muted">Download every required packet below, complete all pages, gather signatures, then upload the finished documents as one PDF.</p><div className="mt-5 flex flex-wrap gap-3">{packet.map((form) => <Link key={form.key} href={form.href} target="_blank" className={buttonVariants({ variant: "outline" })}><FileDown className="h-4 w-4" />{form.shortTitle}</Link>)}</div>{!locked && <div className="mt-6 rounded-xl border border-dashed border-brand/30 bg-brand/[0.03] p-5"><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setPaperFile(event.target.files?.[0] ?? null)} /><Button type="button" className="mt-4" onClick={uploadPaper} disabled={!paperFile || busy !== null}>{busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload completed packet</Button>{paperName && <p className="mt-3 text-sm font-semibold text-success">Uploaded: {paperName}</p>}</div>}</div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
      {message && <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">{message}</div>}
      {locked && getWorkflowFees(workflowKey).length > 0 && (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.05] p-5 sm:p-6">
          <h3 className="text-lg font-bold text-ink">Final step: pay your fee</h3>
          <p className="mt-1 text-sm text-muted">Your packet is submitted. Complete the matching payment so ABCAC can begin review — it is attached to your account automatically.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {getWorkflowFees(workflowKey).map((fee) => (
              <Link key={fee.slug} href={`/account/payments?product=${encodeURIComponent(fee.slug)}${applicationId ? `&application=${encodeURIComponent(applicationId)}` : ""}`} className={buttonVariants({})}>
                {fee.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
      {locked ? <div className="sticky bottom-4 z-20 rounded-2xl border border-success/20 bg-success/95 p-4 text-center text-sm font-semibold text-white shadow-lg backdrop-blur">This packet has been submitted and is locked for ABCAC review. Outside signers may still complete invited sections.</div> : <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur"><div className="text-sm"><p className="font-semibold">{mode === "paper" || digitalPacketComplete ? "Your packet is ready to submit." : `${completedForms} of ${packet.length} required forms confirmed`}</p>{mode === "digital" && !digitalPacketComplete && <p className="mt-1 text-xs text-muted">Complete and confirm every form before submitting.</p>}</div><div className="flex flex-wrap gap-3"><Button type="button" variant="outline" size="lg" onClick={() => save("draft")} disabled={busy !== null}>{busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save draft"}</Button><Button type="button" size="lg" onClick={() => save("submitted")} disabled={busy !== null || (mode === "digital" && !digitalPacketComplete)}>{busy === "submit" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit complete packet"}</Button></div></div>}
    </div>
  );
}
