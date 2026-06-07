"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-9 rounded-lg border border-line bg-bg px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const ACCOUNT = ["pending", "approved", "rejected"];
const ROLES = ["member", "admin"];

export function MemberManage({ id, accountStatus, role }: { id: string; accountStatus: string | null; role: string | null }) {
  const router = useRouter();
  const [acct, setAcct] = useState(accountStatus ?? "approved");
  const [r, setR] = useState(role ?? "member");
  const [busy, setBusy] = useState(false);

  const dirty = acct !== (accountStatus ?? "approved") || r !== (role ?? "member");

  async function save() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("profiles")
        .update({ account_status: acct, portal_role: r, account_reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) { alert("Save failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "member_update",
          target_table: "profiles",
          target_id: id,
          details: { account_status: acct, portal_role: r },
        });
      } catch { /* best-effort */ }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={acct} onChange={(e) => setAcct(e.target.value)} className={field} aria-label="Account status">
        {ACCOUNT.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={r} onChange={(e) => setR(e.target.value)} className={field} aria-label="Role">
        {ROLES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Button size="sm" onClick={save} disabled={busy || !dirty}>Save</Button>
    </div>
  );
}
