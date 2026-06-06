"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const CATEGORIES = ["General", "Ethics", "Cultural Diversity", "HIV/AIDS"];
const MAX_BYTES = 10 * 1024 * 1024;

export function CeuSubmitForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement)?.value.trim();
    const course = get("course"), provider = get("provider"), hours = get("hours"), category = get("category"), date = get("date");
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!course || !provider || !hours || !category || !date) return setError("Please complete all fields.");
    if (file && file.size > MAX_BYTES) return setError("Certificate must be under 10MB.");

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — please sign in again."); setLoading(false); return; }

      let certUrl: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("ceu-certificates").upload(path, file);
        if (upErr) throw upErr;
        certUrl = path;
      }
      const { error: insErr } = await supabase.from("ceu_records").insert({
        member_id: user.id,
        course_name: course,
        provider,
        hours: parseFloat(hours),
        category,
        completion_date: date,
        certificate_url: certUrl,
        status: "pending",
      });
      if (insErr) throw insErr;
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Log CEU Hours</Button>;
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-line bg-surface p-6">
      <h3 className="mb-4">Log CEU Hours</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Course / Workshop</span><input name="course" className={field} required /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Provider</span><input name="provider" className={field} required /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Hours</span><input name="hours" type="number" min="0" step="0.5" className={field} required /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Category</span>
          <select name="category" className={field} required defaultValue="">
            <option value="" disabled>— Select —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Completion Date</span><input name="date" type="date" className={field} required /></label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Certificate (optional, PDF/JPG/PNG)</span><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" /></label>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
