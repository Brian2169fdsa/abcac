"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const TYPES = [
  "Education Verification (Degree/Transcript)",
  "Experience Documentation (Hours Log)",
  "Training Verification (Certificate)",
  "Supervision Agreement",
  "CEU Certificate of Completion",
  "ID / Government Photo ID",
  "IC&RC Reciprocity Documents",
  "Other",
];
const CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["pdf", "jpg", "jpeg", "png"];

export function DocumentUpload() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const type = (form.elements.namedItem("type") as HTMLSelectElement).value;
    const relatedCert = (form.elements.namedItem("related_cert") as HTMLSelectElement).value || null;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!type || !file) return setError("Choose a document type and file.");
    if (file.size > MAX_BYTES) return setError("File must be under 10MB.");
    if (!ALLOWED.includes((file.name.split(".").pop() || "").toLowerCase())) return setError("Use a PDF, JPG, or PNG.");

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); setLoading(false); return; }
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("member-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        member_id: user.id, document_type: type, related_cert: relatedCert, file_name: file.name, file_path: path,
        file_size_kb: Math.round(file.size / 1024), status: "pending",
      });
      if (insErr) throw insErr;
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-line bg-surface p-6">
      <h3 className="mb-4">Upload a document</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Document type</span>
          <select name="type" className={field} defaultValue="" required>
            <option value="" disabled>— Select —</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Related certification (optional)</span>
          <select name="related_cert" className={field} defaultValue="">
            <option value="">— None / Not applicable —</option>
            {CREDENTIALS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">File (PDF/JPG/PNG, max 10MB)</span>
          <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" required />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="mt-4">{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Upload"}</Button>
    </form>
  );
}
