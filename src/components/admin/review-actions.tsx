"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Approve/reject for documents and ceu_records. The migration-005 status
// triggers email the member automatically when the status changes.
export function ReviewActions({ table, id, status }: { table: "documents" | "ceu_records"; id: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: string) {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const patch: Record<string, unknown> = { status: next, reviewed_at: new Date().toISOString() };
      if (next === "rejected") {
        const note = window.prompt("Reason (optional, shared with the member):") ?? "";
        patch.admin_notes = note || null;
      }
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) { alert("Update failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: `${table}_${next}`,
          target_table: table,
          target_id: id,
          details: { status: next },
        });
      } catch { /* best-effort */ }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={() => set("approved")} disabled={busy}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => set("rejected")} disabled={busy}>Reject</Button>
      </div>
    );
  }
  return <Button size="sm" variant="ghost" onClick={() => set("pending")} disabled={busy}>Reopen</Button>;
}
