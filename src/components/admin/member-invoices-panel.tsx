import { InvoicesStatusChip } from "@/components/account/invoices-status-chip";

/**
 * ADMIN MIRROR — the member's Invoices & Payments exactly as they see them on
 * /account/invoices, but read-only (no pay / receipt actions). Lets an admin
 * view the client's billing experience from the member detail page.
 *
 * Data shapes mirror src/app/(portal)/account/invoices/page.tsx.
 */

export interface MemberInvoice {
  id: string;
  invoice_number: string | null;
  description: string | null;
  amount_cents: number | null;
  status: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export interface MemberPayment {
  id: string;
  product_name: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string | null;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function money(c: number | null | undefined) {
  return "$" + ((c ?? 0) / 100).toFixed(2);
}
function isPaid(status: string | null) {
  return status === "paid" || status === "succeeded";
}

export function MemberInvoicesPanel({
  invoices,
  payments,
}: {
  invoices: MemberInvoice[];
  payments: MemberPayment[];
}) {
  const openInvoices = invoices.filter((inv) => !isPaid(inv.status));
  const amountDue = openInvoices.reduce((s, inv) => s + (inv.amount_cents ?? 0), 0);
  const totalPaid =
    invoices.filter((inv) => isPaid(inv.status)).reduce((s, inv) => s + (inv.amount_cents ?? 0), 0) +
    payments.filter((p) => isPaid(p.status)).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary stat tiles — same three the member sees. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Amount due</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand">{money(amountDue)}</div>
          <div className="mt-1 text-sm text-muted">
            {openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total paid</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand">{money(totalPaid)}</div>
          <div className="mt-1 text-sm text-muted">across invoices &amp; payments</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Invoices on file</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand">{invoices.length}</div>
          <div className="mt-1 text-sm text-muted">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} recorded
          </div>
        </div>
      </div>

      {/* Invoices */}
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-bg px-5 py-10 text-center text-sm text-muted">
          No invoices yet. Any charges issued by ABCAC will appear here for the member to pay.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold text-ink">{inv.invoice_number ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{inv.description ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{fmt(inv.created_at)}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{money(inv.amount_cents)}</td>
                  <td className="px-5 py-3">
                    <InvoicesStatusChip status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-muted">{isPaid(inv.status) ? fmt(inv.paid_at ?? inv.created_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payments (only when present, matching the member page) */}
      {payments.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-ink">Payments</div>
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold text-ink">{p.product_name ?? "Payment"}</td>
                    <td className="px-5 py-3 text-muted">{fmt(p.created_at)}</td>
                    <td className="px-5 py-3 font-semibold text-ink">{money(p.amount_cents)}</td>
                    <td className="px-5 py-3">
                      <InvoicesStatusChip status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
