"use client";

import { useMemo, useState } from "react";
import { paymentsEnabled } from "@/lib/feature-flags";
import { PaymentsPausedNotice } from "@/components/payments-paused-notice";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildCertSyncPlan, type SyncEligibleCertification } from "@/lib/cert-sync";
import { saveCertificationSync, type CertificationSyncInput } from "./save-certification-sync";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type StoredPlan = {
  targetExpiration: string;
  items: Array<{ id: string; certType: string | null; certNumber: string | null; oldExpiration: string; monthsForward: number }>;
  totalMonths: number;
  totalFeeCents: number;
};

type Details = {
  submissionMode?: "digital" | "paper";
  fullName?: string;
  phone?: string;
  plan?: StoredPlan | null;
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

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function CertificationSyncForm({
  request,
  certifications,
  preferredMode,
  profile,
}: {
  request: ExistingRequest;
  certifications: SyncEligibleCertification[];
  preferredMode: "digital" | "paper";
  profile: { fullName: string; phone: string };
}) {
  const saved = readDetails(request);
  const [requestId, setRequestId] = useState(request?.id ?? null);
  const [requestStatus, setRequestStatus] = useState(request?.status ?? "draft");
  const [savedPlan, setSavedPlan] = useState<StoredPlan | null>(saved.plan ?? null);
  const [mode, setMode] = useState<"digital" | "paper">(saved.submissionMode ?? preferredMode);
  const [fullName, setFullName] = useState(saved.fullName ?? profile.fullName);
  const [phone, setPhone] = useState(saved.phone ?? profile.phone);
  const [selectedIds, setSelectedIds] = useState<string[]>(saved.plan?.items.map((item) => item.id) ?? []);
  const [signatureName, setSignatureName] = useState(request?.signature_name ?? "");
  const [paperDocumentPath, setPaperDocumentPath] = useState(saved.paperDocumentPath ?? null);
  const [paperFileName, setPaperFileName] = useState(saved.paperFileName ?? null);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState<"save" | "submit" | "pay" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = requestStatus === "submitted" || requestStatus === "under_review";

  // Live preview computed the same way the server will compute it authoritatively
  // on save — nothing here is trusted for the actual charge.
  const preview = useMemo(() => {
    const selected = certifications.filter((c) => selectedIds.includes(c.id));
    const result = buildCertSyncPlan(selected);
    return result.ok ? result.plan : null;
  }, [certifications, selectedIds]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= 6 ? current : [...current, id]));
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
      certificationIds: selectedIds,
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
      setSavedPlan(result.plan);
      setMessage(status === "draft" ? "Draft saved. You can safely leave and return later." : "Request submitted. Continue to secure payment to complete the request.");
      return { id: result.id, plan: result.plan };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your request.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkout(id: string | null, plan: StoredPlan | null) {
    if (!id || !paymentsEnabled) return;
    const months = plan?.totalMonths ?? savedPlan?.totalMonths;
    if (!months) return;
    setError(null);
    setBusy("pay");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "certification-sync",
          quantity: months,
          syncApplicationId: id,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        if (["payments_not_configured", "price_not_found", "payments_paused"].includes(data.error)) {
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
    if (pending) { await checkout(requestId, savedPlan); return; }
    const result = await save("submitted");
    if (result) await checkout(result.id, result.plan);
  }

  // Not enough active credentials to sync at all — say so plainly rather than
  // showing a checklist that can never produce a valid request.
  if (mode === "digital" && certifications.length < 2 && !pending) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-2xl">You need two active credentials to sync</h2>
        <p className="mt-2 text-muted">
          Certification Sync aligns two or more of your active ABCAC credentials to a single renewal date.{" "}
          {certifications.length === 0
            ? "Your account doesn't show any active certifications yet."
            : "Your account shows only one active certification right now."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/certifications" className={buttonVariants({ variant: "outline" })}>View your certifications</Link>
          <button type="button" onClick={() => setMode("paper")} className="text-sm font-semibold text-brand hover:underline self-center">
            Or upload a completed paper request instead →
          </button>
        </div>
      </div>
    );
  }

  if (pending) {
    const total = savedPlan ? savedPlan.totalFeeCents / 100 : 0;
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h2 className="mt-4 text-2xl">Your sync request is saved</h2>
        {savedPlan ? (
          <>
            <p className="mt-2 text-muted">
              ABCAC will align {savedPlan.items.length} credential{savedPlan.items.length !== 1 ? "s" : ""} to a new expiration
              date of <strong>{fmtDate(savedPlan.targetExpiration)}</strong> once approved. Complete the one-time ${total.toFixed(2)} payment if you have not already paid.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {savedPlan.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-2.5">
                  <span className="font-semibold">{item.certType ?? "Credential"}{item.certNumber ? ` · ${item.certNumber}` : ""}</span>
                  <span className="text-muted">{fmtDate(item.oldExpiration)} {item.monthsForward > 0 ? `→ ${fmtDate(savedPlan.targetExpiration)} (${item.monthsForward} mo.)` : "(already at target)"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-muted">ABCAC can now see this paper request in the admin queue.</p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {paymentsEnabled && savedPlan && <Button size="lg" onClick={() => checkout(requestId, savedPlan)} disabled={busy === "pay"}>{busy === "pay" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : `Pay $${total.toFixed(2)} securely`}</Button>}
          <Link href="/account/applications" className={buttonVariants({ variant: "outline", size: "lg" })}>Track request status</Link>
        </div>
        {!paymentsEnabled && <div className="mt-6"><PaymentsPausedNotice compact /></div>}
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
          <div>
            <h3>Certifications to synchronize</h3>
            <p className="mt-1 text-sm text-muted">Select two or more of your active credentials. The one expiring soonest moves forward to match the latest.</p>
          </div>
          <div className="mt-4 space-y-2">
            {certifications.map((cert) => {
              const checked = selectedIds.includes(cert.id);
              return (
                <label key={cert.id} className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${checked ? "border-brand bg-brand/[0.04]" : "border-line bg-bg"}`}>
                  <span className="flex items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 accent-brand" checked={checked} onChange={() => toggle(cert.id)} />
                    <span>
                      <span className="block font-semibold text-ink">{cert.cert_type ?? "Credential"}{cert.cert_number ? ` · ${cert.cert_number}` : ""}</span>
                      <span className="block text-xs text-muted">Expires {cert.expiration_date ? fmtDate(cert.expiration_date) : "—"}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {preview && (
            <div className="mt-5 rounded-xl border border-accent/30 bg-accent/10 p-5">
              <p className="font-semibold text-ink">New expiration date for all selected credentials: {fmtDate(preview.targetExpiration)}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {preview.items.map((item) => (
                  <li key={item.id}>{item.certType ?? "Credential"}: {fmtDate(item.oldExpiration)} {item.monthsForward > 0 ? `→ moves forward ${item.monthsForward} month${item.monthsForward !== 1 ? "s" : ""}` : "(no change — already at target)"}</li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-accent/30 pt-4">
                <span className="font-semibold">One-time synchronization fee</span>
                <span className="text-2xl font-bold text-brand">${(preview.totalFeeCents / 100).toFixed(2)}</span>
              </div>
            </div>
          )}
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

      {mode === "digital" && (
        <div className="mt-7 rounded-xl border border-line bg-bg p-5">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-muted">I request that ABCAC synchronize the selected credentials, and I certify that the information is accurate.</span></label>
          <label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold">Electronic signature (type your full name) *</span><input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} className={field} /></label>
        </div>
      )}

      {message && <p className="mt-5 rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-muted">{message}</p>}
      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" onClick={() => save("draft")} disabled={busy !== null}>{busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Save draft"}</Button>
        <Button type="button" size="lg" onClick={submitAndPay} disabled={busy !== null || (mode === "digital" && !preview)}>
          {busy === "submit" || busy === "pay" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : paymentsEnabled && preview ? `Submit and pay $${(preview.totalFeeCents / 100).toFixed(2)}` : "Submit request"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">Your draft and documents are stored privately in your ABCAC account.</p>
    </div>
  );
}
