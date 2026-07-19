"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveCertificationSync, type CertificationSyncInput, type SyncCredentialInput } from "./save-certification-sync";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const emptyCredential = (): SyncCredentialInput => ({ type: "", number: "", expirationDate: "" });

type Details = {
  submissionMode?: "digital" | "paper";
  fullName?: string;
  phone?: string;
  credentials?: SyncCredentialInput[];
  monthsForward?: number;
  targetExpirationDate?: string;
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
};

type ExistingRequest = {
  id: string;
  status: string | null;
  member_notes: string | null;
  signature_name: string | null;
} | null;

function readDetails(request: ExistingRequest): Details {
  if (!request?.member_notes) return {};
  try { return JSON.parse(request.member_notes) as Details; } catch { return {}; }
}

export function CertificationSyncForm({
  request,
  preferredMode,
  profile,
}: {
  request: ExistingRequest;
  preferredMode: "digital" | "paper";
  profile: { fullName: string; phone: string };
}) {
  const saved = readDetails(request);
  const [requestId, setRequestId] = useState(request?.id ?? null);
  const [requestStatus, setRequestStatus] = useState(request?.status ?? "draft");
  const [mode, setMode] = useState<"digital" | "paper">(saved.submissionMode ?? preferredMode);
  const [fullName, setFullName] = useState(saved.fullName ?? profile.fullName);
  const [phone, setPhone] = useState(saved.phone ?? profile.phone);
  const [credentials, setCredentials] = useState<SyncCredentialInput[]>(saved.credentials?.length ? saved.credentials : [emptyCredential(), emptyCredential()]);
  const [monthsForward, setMonthsForward] = useState(saved.monthsForward ?? 1);
  const [targetExpirationDate, setTargetExpirationDate] = useState(saved.targetExpirationDate ?? "");
  const [signatureName, setSignatureName] = useState(request?.signature_name ?? "");
  const [paperDocumentPath, setPaperDocumentPath] = useState(saved.paperDocumentPath ?? null);
  const [paperFileName, setPaperFileName] = useState(saved.paperFileName ?? null);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState<"save" | "submit" | "pay" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = Math.max(1, monthsForward) * 15;
  const pending = requestStatus === "submitted" || requestStatus === "under_review";

  function updateCredential(index: number, patch: Partial<SyncCredentialInput>) {
    setCredentials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function uploadPaperFile() {
    if (!paperFile) return { path: paperDocumentPath, fileName: paperFileName };
    if (paperFile.size > 10 * 1024 * 1024) throw new Error("The paper form must be 10MB or smaller.");
    const extension = paperFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) throw new Error("Upload a PDF, JPG, or PNG file.");

    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Your session expired. Please sign in again.");
    const safeName = paperFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/certification-sync/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from("member-documents").upload(path, paperFile);
    if (uploadError) throw uploadError;
    const { error: documentError } = await supabase.from("documents").insert({
      member_id: user.id,
      document_type: "Certification Synchronization Request",
      file_name: paperFile.name,
      file_path: path,
      file_size_kb: Math.round(paperFile.size / 1024),
      status: "pending",
    });
    if (documentError) throw documentError;
    setPaperDocumentPath(path);
    setPaperFileName(paperFile.name);
    setPaperFile(null);
    return { path, fileName: paperFile.name };
  }

  function payload(status: "draft" | "submitted", uploaded?: { path: string | null; fileName: string | null }): CertificationSyncInput {
    return {
      id: requestId,
      status,
      submissionMode: mode,
      fullName,
      phone,
      credentials,
      monthsForward,
      targetExpirationDate,
      signatureName,
      paperDocumentPath: uploaded?.path ?? paperDocumentPath,
      paperFileName: uploaded?.fileName ?? paperFileName,
    };
  }

  async function save(status: "draft" | "submitted") {
    setError(null);
    setMessage(null);
    if (status === "submitted" && mode === "digital" && !attested) {
      setError("Confirm the certification and signature statement before submitting.");
      return null;
    }
    setBusy(status === "draft" ? "save" : "submit");
    try {
      const uploaded = mode === "paper" ? await uploadPaperFile() : undefined;
      const result = await saveCertificationSync(payload(status, uploaded));
      if (!result.ok) throw new Error(result.error);
      setRequestId(result.id);
      setRequestStatus(result.status);
      setMessage(status === "draft" ? "Draft saved. You can safely leave and return later." : "Request submitted. Continue to secure payment to complete the request.");
      return result.id;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your request.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkout(id = requestId) {
    if (!id) return;
    setError(null);
    setBusy("pay");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "certification-sync",
          quantity: monthsForward,
          syncApplicationId: id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        if (["payments_not_configured", "price_not_found"].includes(data.error)) {
          setMessage("Your request is saved and visible to ABCAC. Online payment is coming soon; staff can follow up without you re-entering the form.");
          return;
        }
        throw new Error("Secure checkout could not be started. Your request is still saved.");
      }
      window.location.href = data.url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Secure checkout could not be started.");
    } finally {
      setBusy(null);
    }
  }

  async function submitAndPay() {
    const id = pending ? requestId : await save("submitted");
    if (id) await checkout(id);
  }

  if (pending) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-4 text-2xl">Your sync request is saved</h2>
        <p className="mt-2 text-muted">ABCAC can now see this request in the admin queue. Complete the one-time ${total.toFixed(2)} payment if you have not already paid.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => checkout()} disabled={busy === "pay"}>{busy === "pay" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : `Pay $${total.toFixed(2)} securely`}</Button>
          <Link href="/account/applications" className={buttonVariants({ variant: "outline", size: "lg" })}>Track request status</Link>
        </div>
        {message && <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-muted">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap gap-3 border-b border-line pb-6">
        <button type="button" onClick={() => setMode("digital")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "digital" ? "bg-brand text-white" : "bg-bg text-muted"}`}>Digital form</button>
        <button type="button" onClick={() => setMode("paper")} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === "paper" ? "bg-brand text-white" : "bg-bg text-muted"}`}>Upload paper form</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Full legal name *</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} className={field} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className={field} type="tel" /></label>
      </div>

      {mode === "digital" ? (
        <div className="mt-7">
          <div className="flex items-center justify-between gap-4">
            <div><h3>Certifications to synchronize</h3><p className="mt-1 text-sm text-muted">Enter at least two active ABCAC credentials.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => setCredentials((current) => [...current, emptyCredential()])} disabled={credentials.length >= 6}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
          </div>
          <div className="mt-4 space-y-3">
            {credentials.map((credential, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-line bg-bg p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                <label><span className="mb-1 block text-xs font-semibold text-muted">Credential type</span><input value={credential.type} onChange={(event) => updateCredential(index, { type: event.target.value })} className={field} placeholder="CADAC, CCJP, AADC…" /></label>
                <label><span className="mb-1 block text-xs font-semibold text-muted">Certification number</span><input value={credential.number} onChange={(event) => updateCredential(index, { number: event.target.value })} className={field} /></label>
                <label><span className="mb-1 block text-xs font-semibold text-muted">Expiration date</span><input type="date" value={credential.expirationDate} onChange={(event) => updateCredential(index, { expirationDate: event.target.value })} className={field} /></label>
                <Button type="button" variant="ghost" className="h-11 w-11 self-end px-0" onClick={() => setCredentials((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={credentials.length <= 2} aria-label={`Remove certification ${index + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-7 rounded-xl border border-line bg-bg p-5">
          <h3>Completed paper request</h3>
          <p className="mt-2 text-sm text-muted">Download and complete the official form, then upload the signed copy here.</p>
          <a href="/forms/certification-synchronization-request.pdf" download className="mt-4 inline-flex items-center gap-2 font-semibold text-brand hover:underline"><Download className="h-4 w-4" aria-hidden /> Download printable PDF</a>
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand/30 bg-surface px-4 py-4 text-sm hover:border-brand">
            <Upload className="h-5 w-5 text-brand" aria-hidden />
            <span>{paperFile?.name || paperFileName || "Choose completed PDF, JPG, or PNG (max 10MB)"}</span>
            <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setPaperFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}

      <div className="mt-7 grid gap-4 rounded-xl border border-accent/30 bg-accent/10 p-5 sm:grid-cols-2">
        <label><span className="mb-1.5 block text-sm font-semibold">Months moved forward *</span><input type="number" min="1" max="120" value={monthsForward} onChange={(event) => setMonthsForward(Math.max(1, Number(event.target.value) || 1))} className={field} /></label>
        <label><span className="mb-1.5 block text-sm font-semibold">Requested unified expiration date</span><input type="date" value={targetExpirationDate} onChange={(event) => setTargetExpirationDate(event.target.value)} className={field} /></label>
        <div className="sm:col-span-2 flex items-center justify-between gap-4 border-t border-accent/30 pt-4"><span className="font-semibold">One-time synchronization fee</span><span className="text-2xl font-bold text-brand">${total.toFixed(2)}</span></div>
      </div>

      {mode === "digital" && (
        <div className="mt-7 rounded-xl border border-line bg-bg p-5">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-muted">I request that ABCAC synchronize the listed credentials, and I certify that the information is accurate.</span></label>
          <label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold">Electronic signature (type your full name) *</span><input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} className={field} /></label>
          <p className="mt-3 text-xs text-muted">Third-party attestations and multi-signer routing are coming soon. This request does not require an outside attestor.</p>
        </div>
      )}

      {message && <p className="mt-5 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-muted">{message}</p>}
      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" onClick={() => save("draft")} disabled={busy !== null}>{busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Save draft"}</Button>
        <Button type="button" size="lg" onClick={submitAndPay} disabled={busy !== null}>{busy === "submit" || busy === "pay" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : `Submit and pay $${total.toFixed(2)}`}</Button>
      </div>
      <p className="mt-3 text-xs text-muted">Your draft and documents are stored privately in your ABCAC account.</p>
    </div>
  );
}
