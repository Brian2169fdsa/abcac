"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export interface MemberOption {
  id: string;
  label: string;
}

export function RequestDocumentForm({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setIsError(false);
    const f = e.currentTarget;
    const member_id = (f.elements.namedItem("member") as HTMLSelectElement).value;
    const document_type = (f.elements.namedItem("document_type") as HTMLInputElement).value.trim();
    const note = (f.elements.namedItem("note") as HTMLInputElement).value.trim();
    if (!member_id || !document_type) {
      setIsError(true);
      setMsg("Select a member and enter a document type.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("document_requests").insert({
        member_id,
        document_type,
        note: note || null,
        status: "open",
      });
      if (error) {
        setIsError(true);
        setMsg("Failed: " + error.message);
        return;
      }
      f.reset();
      setMsg("Document request sent.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border border-line bg-surface p-6">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Member</span>
        <select name="member" className={field} defaultValue="">
          <option value="" disabled>— Select member —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Document Type</span>
        <input name="document_type" placeholder="e.g. Updated transcript" className={field} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Note (optional)</span>
        <input name="note" placeholder="Additional context for the member" className={field} />
      </label>
      {msg && (
        <p className={`text-sm ${isError ? "text-red-600" : "text-muted"}`}>{msg}</p>
      )}
      <Button type="submit" disabled={busy}>Request Document</Button>
    </form>
  );
}
