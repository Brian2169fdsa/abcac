"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];
const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["pdf", "jpg", "jpeg", "png"];

type Mode = "initial" | "renewal";

interface Props {
  mode: Mode;
  prefillName: string;
}

/** Online certification / recertification application — writes to the shared
 *  portal database (applications + documents +, for renewal, ceu_records). */
export function MemberApplicationForm({ mode, prefillName }: Props) {
  const [credential, setCredential] = useState("");
  const [notes, setNotes] = useState("");
  const [ceuHours, setCeuHours] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const isRenewal = mode === "renewal";

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    for (const f of list) {
      if (f.size > MAX_BYTES) return setError(`${f.name} is over 10MB.`);
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED.includes(ext)) return setError(`${f.name} must be a PDF, JPG, or PNG.`);
    }
    setError(null);
    setFiles(list);
  }

  async function submit() {
    setError(null);
    if (!credential) return setError("Please select your credential.");
    if (mode === "initial" && files.length === 0) return setError("Please upload your supporting documents.");
    setStatus("saving");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Please sign in again.");
        setStatus("idle");
        return;
      }

      const { data: app, error: appErr } = await supabase
        .from("applications")
        .insert({
          member_id: user.id,
          app_type: mode,
          cert_type: credential,
          status: "submitted",
          admin_notes: notes || null,
        })
        .select("id")
        .single();
      if (appErr) throw appErr;

      // Upload supporting documents to the member's private folder.
      for (const file of files) {
        const path = `${user.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("member-documents").upload(path, file);
        if (upErr) throw upErr;
        await supabase.from("documents").insert({
          member_id: user.id,
          document_type: isRenewal ? "Continuing Education Documentation" : "Certification Application Document",
          related_cert: credential,
          file_name: file.name,
          file_path: path,
          file_size_kb: Math.round(file.size / 1024),
          status: "pending",
        });
      }

      // For renewals, record the attested CEU total as a pending record for review.
      if (isRenewal && ceuHours) {
        await supabase.from("ceu_records").insert({
          member_id: user.id,
          course_name: "Recertification CEU summary",
          provider: "Member-submitted",
          hours: parseFloat(ceuHours) || 0,
          category: "General",
          completion_date: new Date().toISOString().slice(0, 10),
          status: "pending",
        });
      }

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-6">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h3 className="mt-3">Application submitted</h3>
        <p className="mt-2 text-muted">
          Thank you, {prefillName}. ABCAC will review your {isRenewal ? "recertification" : "application"} and
          supporting documents. You can track the status in your member portal.
        </p>
        <Button className="mt-4" onClick={() => (window.location.href = "/portal")}>Go to the portal</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-7">
      <div className="space-y-4">
        <div>
          <label htmlFor="credential" className="mb-1.5 block text-sm font-semibold">Credential</label>
          <select id="credential" value={credential} onChange={(e) => setCredential(e.target.value)} className={field}>
            <option value="">— Select —</option>
            {CREDENTIALS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {isRenewal && (
          <div>
            <label htmlFor="ceuHours" className="mb-1.5 block text-sm font-semibold">Total CEU hours completed this cycle</label>
            <input id="ceuHours" type="number" min="0" step="0.5" value={ceuHours} onChange={(e) => setCeuHours(e.target.value)} className={field} placeholder="e.g. 40" />
            <p className="mt-1 text-xs text-muted">Include your Ethics and Cultural Diversity hours. Attach your CE certificates below.</p>
          </div>
        )}

        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-semibold">
            {isRenewal ? "Notes for the reviewer (optional)" : "Education & experience summary"}
          </label>
          <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            placeholder={isRenewal ? "Anything ABCAC should know about your renewal." : "Briefly describe your degree, education hours, and supervised work experience."} />
        </div>

        <div>
          <label htmlFor="docs" className="mb-1.5 block text-sm font-semibold">
            Supporting documents {isRenewal ? "(CE certificates)" : "(transcript, hours log, etc.)"}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-bg px-3 py-3 text-sm text-muted hover:border-brand">
            <Upload className="h-4 w-4" aria-hidden />
            <span>{files.length ? `${files.length} file(s) selected` : "Choose PDF, JPG, or PNG files (max 10MB each)"}</span>
            <input id="docs" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={onFiles} className="sr-only" />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={submit} disabled={status === "saving"} size="lg" className="w-full">
          {status === "saving" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : `Submit ${isRenewal ? "Recertification" : "Application"}`}
        </Button>
        <p className="text-center text-xs text-muted">Your documents are stored privately and reviewed by ABCAC staff.</p>
      </div>
    </div>
  );
}
