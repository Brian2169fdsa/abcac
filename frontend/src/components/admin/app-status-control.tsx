"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const STATUSES = ["submitted", "under_review", "approved", "rejected"];
const field = "h-9 rounded-lg border border-line bg-bg px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

// Set an application's status (migration-005 trigger emails the member on change).
export function AppStatusControl({ id, status }: { id: string; status: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(status ?? "submitted");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("applications")
        .update({ status: value, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) { alert("Update failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "application_status",
          target_table: "applications",
          target_id: id,
          details: { status: value },
        });
      } catch { /* best-effort */ }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className={field}>
        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      <Button size="sm" onClick={save} disabled={busy || value === status}>Save</Button>
    </div>
  );
}
