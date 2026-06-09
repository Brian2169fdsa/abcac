"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { InvoicesStatusChip } from "@/components/account/invoices-status-chip";
import { setInvoiceStatus, updateInvoice } from "@/app/(admin)/admin/members/[id]/billing-actions";

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function money(c: number | null | undefined) {
  return "$" + ((c ?? 0) / 100).toFixed(2);
}

/**
 * Admin invoice controls (parity gap B6). Per invoice, an admin can mark it
 * paid / unpaid / void and edit its amount + description. All writes go through
 * server actions that re-check admin rights server-side — MANUAL states only,
 * no Stripe. Mirrors the read-only MemberInvoicesPanel styling.
 */
export function MemberInvoiceManage({
  memberId,
  invoices,
}: {
  memberId: string;
  invoices: any[];
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Manage invoices</h3>
        <span className="text-xs text-muted">{invoices.length} total</span>
      </div>
      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-muted">
          No invoices for this member yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {invoices.map((inv) => (
            <InvoiceRow key={inv.id} memberId={memberId} invoice={inv} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InvoiceRow({ memberId, invoice }: { memberId: string; invoice: any }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(((invoice.amount_cents ?? 0) / 100).toFixed(2));
  const [description, setDescription] = useState(invoice.description ?? "");

  function changeStatus(status: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await setInvoiceStatus(memberId, String(invoice.id), status);
      setFeedback(res.ok ? { ok: true, text: `Marked ${status}.` } : { ok: false, text: "Failed: " + res.error });
    });
  }

  function saveEdit() {
    setFeedback(null);
    const amt = parseFloat(amount);
    const desc = description.trim();
    if (!desc || !(amt >= 0) || !Number.isFinite(amt)) {
      setFeedback({ ok: false, text: "Enter a description and a non-negative amount." });
      return;
    }
    startTransition(async () => {
      const res = await updateInvoice(memberId, String(invoice.id), { amount: amt, description: desc });
      if (res.ok) {
        setEditing(false);
        setFeedback({ ok: true, text: "Invoice updated." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {invoice.invoice_number ?? "—"} · {money(invoice.amount_cents)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="truncate">{invoice.description ?? "—"}</span>
            <span>Created {fmt(invoice.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoicesStatusChip status={invoice.status} />
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || invoice.status === "paid"} onClick={() => changeStatus("paid")}>
          Mark paid
        </Button>
        <Button size="sm" variant="outline" disabled={pending || invoice.status === "unpaid"} onClick={() => changeStatus("unpaid")}>
          Mark unpaid
        </Button>
        <Button size="sm" variant="ghost" disabled={pending || invoice.status === "void"} onClick={() => changeStatus("void")}>
          Void
        </Button>
      </div>

      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Description</span>
            <input
              className={field}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Amount (USD)</span>
            <input
              className={field}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
            />
          </label>
          <div className="sm:col-span-2">
            <Button size="sm" disabled={pending} onClick={saveEdit}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={`mt-2 text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
    </li>
  );
}
