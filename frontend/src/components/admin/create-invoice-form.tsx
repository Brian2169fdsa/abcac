"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { MemberOption } from "@/components/admin/send-message-form";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function CreateInvoiceForm({ members }: { members: MemberOption[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const f = e.currentTarget;
    const memberId = (f.elements.namedItem("member") as HTMLSelectElement).value;
    const desc = (f.elements.namedItem("desc") as HTMLInputElement).value.trim();
    const amount = parseFloat((f.elements.namedItem("amount") as HTMLInputElement).value);
    if (!memberId || !desc || !(amount > 0)) { setMsg("Select a member, description, and amount."); return; }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const invoiceNumber = "INV-" + Date.now().toString(36).toUpperCase();
      const amount_cents = Math.round(amount * 100);
      const { error } = await supabase.from("invoices").insert({
        member_id: memberId, invoice_number: invoiceNumber, description: desc,
        amount_cents, status: "unpaid",
      });
      if (error) { setMsg("Failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "invoice_created",
          target_table: "invoices",
          target_id: null,
          details: { member_id: memberId, amount_cents },
        });
      } catch { /* best-effort */ }
      f.reset();
      setMsg(`Invoice ${invoiceNumber} created.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border border-line bg-surface p-6">
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">Member</span>
        <select name="member" className={field} defaultValue="">
          <option value="" disabled>— Select member —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Description</span><input name="desc" className={field} placeholder="e.g. Renewal Fee" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Amount (USD)</span><input name="amount" type="number" min="0" step="0.01" className={field} placeholder="150.00" /></label>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button type="submit" disabled={busy}>Create Invoice</Button>
    </form>
  );
}
