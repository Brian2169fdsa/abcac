"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Complete/reject a member request (name change, verification, reciprocity).
export function RequestReviewActions({ table, id, status }: { table: string; id: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: string) {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const patch: Record<string, unknown> = { status: next };
      // verification_requests tracks completion via completed_at; others use reviewed_at.
      if (table === "verification_requests" && next === "completed") patch.completed_at = new Date().toISOString();
      else patch.reviewed_at = new Date().toISOString();
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) { alert("Update failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: `${table}_${next}`,
          target_table: table,
          target_id: id,
          details: null,
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
        <Button size="sm" onClick={() => set("completed")} disabled={busy}>Complete</Button>
        <Button size="sm" variant="outline" onClick={() => set("rejected")} disabled={busy}>Reject</Button>
      </div>
    );
  }
  return <Button size="sm" variant="ghost" onClick={() => set("pending")} disabled={busy}>Reopen</Button>;
}
