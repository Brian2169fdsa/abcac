"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { decideVerification } from "@/app/(admin)/admin/requests/decide-verification";
import { decideRequest } from "@/app/(admin)/admin/requests/decide-request";

// Approve/deny a member request (name change, verification, reciprocity).
//
// Every decision (a) writes the result + a decided timestamp, (b) records an
// admin_audit_log entry, and (c) emails the member/requester the outcome.
//
//  • verification_requests → dedicated one-click Verified / Not Verified flow
//    (decideVerification — emails the requester; PRESERVED unchanged).
//  • name_change_requests + reciprocity_requests → admin-gated decideRequest
//    server action (emails the member; for approved OUT-of-Arizona reciprocity
//    transfers it also notifies the destination board email on the request).
//  • any other table → generic client-side Complete/Reject fallback.
//
// Props are backward-compatible: existing callers pass only { table, id, status }.
const SERVER_DECISION = new Set(["name_change_requests", "reciprocity_requests"]);

export function RequestReviewActions({ table, id, status }: { table: string; id: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // ─── Name change + reciprocity: admin-gated server decision (write + audit + email) ───
  if (SERVER_DECISION.has(table)) {
    const decide = async (decision: "approve" | "deny" | "reopen") => {
      let note: string | undefined;
      if (decision === "deny") {
        const entered = window.prompt("Optional note to include in the email (denial reason):") ?? "";
        note = entered.trim() || undefined;
      }
      setBusy(true);
      try {
        const res = await decideRequest(table, id, decision, note);
        if (!res.ok) { alert("Update failed: " + res.error); return; }
        router.refresh();
      } finally {
        setBusy(false);
      }
    };
    if (status === "pending" || status == null) {
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide("approve")} disabled={busy}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => decide("deny")} disabled={busy}>Deny</Button>
        </div>
      );
    }
    return <Button size="sm" variant="ghost" onClick={() => decide("reopen")} disabled={busy}>Reopen</Button>;
  }

  // ─── Verification: one-click decision via admin-gated server action ───
  if (table === "verification_requests") {
    const decide = async (result: "verified" | "not_verified") => {
      setBusy(true);
      try {
        const res = await decideVerification(id, result);
        if (!res.ok) { alert("Update failed: " + res.error); return; }
        router.refresh();
      } finally {
        setBusy(false);
      }
    };

    const reopen = async () => {
      setBusy(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase
          .from("verification_requests")
          .update({ status: "pending", completed_at: null, verification_result: null, verified_at: null })
          .eq("id", id);
        if (error) { alert("Update failed: " + error.message); return; }
        router.refresh();
      } finally {
        setBusy(false);
      }
    };

    if (status === "pending") {
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide("verified")} disabled={busy}>Verified</Button>
          <Button size="sm" variant="outline" onClick={() => decide("not_verified")} disabled={busy}>Not Verified</Button>
        </div>
      );
    }
    return <Button size="sm" variant="ghost" onClick={reopen} disabled={busy}>Reopen</Button>;
  }

  // ─── All other request tables: generic Complete/Reject ───
  async function set(next: string) {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const patch: Record<string, unknown> = { status: next };
      // All non-verification request tables track the review time via reviewed_at.
      patch.reviewed_at = next === "pending" ? null : new Date().toISOString();
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
