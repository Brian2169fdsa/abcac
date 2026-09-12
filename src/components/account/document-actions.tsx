"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Editing/deleting is only offered for 'pending' documents by the caller —
// the guard_document_write / guard_document_delete triggers (migration 053)
// reject the write server-side once ABCAC has reviewed the document.
export function EditDocumentTypeForm({ id, currentType }: { id: string; currentType: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentType ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value.trim()) { setError("Enter a document type."); return; }
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: updErr } = await supabase.from("documents").update({ document_type: value.trim() }).eq("id", id).eq("member_id", user.id);
      if (updErr) throw updErr;
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Reviewed documents can no longer be edited.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Edit</Button>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} className="h-9 rounded-lg border border-line bg-bg px-2 text-sm" placeholder="Document type" />
      <Button size="sm" onClick={save} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save"}</Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DeleteDocumentButton({ id, filePath }: { id: string; filePath: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onDelete() {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("documents").delete().eq("id", id).eq("member_id", user.id);
      if (error) { alert(error.message); return; }
      if (filePath) await supabase.storage.from("member-documents").remove([filePath]);
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
