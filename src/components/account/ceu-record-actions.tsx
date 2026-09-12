"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const CATEGORIES = ["General", "Ethics", "Cultural Diversity", "HIV/AIDS"];

export interface CeuRecordForEdit {
  id: string;
  course_name: string | null;
  provider: string | null;
  hours: number | null;
  category: string | null;
  completion_date: string | null;
}

// Editing/deleting is only offered for 'pending' records by the caller — the
// guard_ceu_write / guard_ceu_delete triggers (migration 053) reject the
// write server-side once ABCAC has reviewed the record, so this is enforced
// even if a stale page tries it.
export function EditCeuForm({ record }: { record: CeuRecordForEdit }) {
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
    if (!course || !provider || !hours || !category || !date) { setError("Please complete all fields."); return; }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }
      const { error: updErr } = await supabase
        .from("ceu_records")
        .update({ course_name: course, provider, hours: parseFloat(hours), category, completion_date: date })
        .eq("id", record.id)
        .eq("member_id", user.id);
      if (updErr) throw updErr;
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Reviewed records can no longer be edited.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Edit</Button>;

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Course / Workshop</span><input name="course" className={field} required defaultValue={record.course_name ?? ""} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Provider</span><input name="provider" className={field} required defaultValue={record.provider ?? ""} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Hours</span><input name="hours" type="number" min="0" step="0.5" className={field} required defaultValue={record.hours ?? ""} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Category</span>
          <select name="category" className={field} required defaultValue={record.category ?? ""}>
            <option value="" disabled>— Select —</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Completion Date</span><input name="date" type="date" className={field} required defaultValue={record.completion_date ?? ""} /></label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function DeleteCeuButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onDelete() {
    if (!confirm("Delete this CEU record? This cannot be undone.")) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("ceu_records").delete().eq("id", id).eq("member_id", user.id);
      if (error) { alert(error.message); return; }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={onDelete} disabled={loading} className="text-red-600 hover:text-red-700">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Delete"}
    </Button>
  );
}
