"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Approve/reject a new member account. On approval, the member's self-reported
// certifications are activated, and the member is emailed via admin-notify.
export function AccountApprovalActions({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function notify(subject: string, message: string) {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ member_id: memberId, subject, message }),
      });
    } catch { /* best-effort */ }
  }

  async function approve() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("profiles")
        .update({ account_status: "approved", account_reviewed_at: new Date().toISOString(), account_review_notes: null })
        .eq("id", memberId);
      if (error) { alert("Approve failed: " + error.message); return; }
      await supabase.from("certifications").update({ status: "active" }).eq("member_id", memberId).eq("status", "pending");
      notify("Your ABCAC account is approved", "Welcome! Your member portal account has been approved. You can now sign in and access the full portal.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const note = window.prompt("What needs to change before approval? (shared with the member)") ?? "";
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("profiles")
        .update({ account_status: "rejected", account_reviewed_at: new Date().toISOString(), account_review_notes: note || null })
        .eq("id", memberId);
      if (error) { alert("Reject failed: " + error.message); return; }
      notify("Your ABCAC account needs changes", "Your registration needs updates before approval." + (note ? " Note: " + note : "") + " Please sign in to update and resubmit.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={approve} disabled={busy}>Approve</Button>
      <Button size="sm" variant="outline" onClick={reject} disabled={busy}>Reject</Button>
    </div>
  );
}
