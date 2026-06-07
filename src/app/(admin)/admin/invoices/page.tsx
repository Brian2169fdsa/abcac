import { CreateInvoiceForm } from "@/components/admin/create-invoice-form";
import { ReceiptDownload } from "@/components/receipt-download";
import type { MemberOption } from "@/components/admin/send-message-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ProfileRow { id: string; first_name: string | null; last_name: string | null; email: string | null }
interface Invoice {
  id: string; member_id: string | null; invoice_number: string | null; description: string | null;
  amount_cents: number | null; status: string | null; paid_at: string | null; created_at: string | null;
}

function memberLabel(p: ProfileRow | undefined): string {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—";
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function money(c: number | null) { return "$" + ((c ?? 0) / 100).toFixed(2); }

async function loadData() {
  const sb = createSupabaseServerClient();
  const [{ data: profs }, { data: invs }] = await Promise.all([
    sb.from("profiles").select("id,first_name,last_name,email").order("first_name", { ascending: true }),
    sb.from("invoices").select("*").order("created_at", { ascending: false }),
  ]);
  const profiles = (profs as ProfileRow[]) ?? [];
  const invoices = (invs as Invoice[]) ?? [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const members: MemberOption[] = profiles.map((p) => ({
    id: p.id,
    label: memberLabel(p) + (p.email ? ` (${p.email})` : ""),
  }));
  return { invoices, byId, members };
}

export default async function AdminInvoices() {
  const { invoices, byId, members } = await loadData();

  return (
    <>
      <h1 className="text-2xl font-bold">Invoices &amp; Receipts</h1>
      <p className="mb-6 text-muted">Issue an invoice to a member. They can pay it from their portal, and you can download receipts for paid items.</p>

      <CreateInvoiceForm members={members} />

      <h2 className="mb-3 mt-10 text-xl font-bold">All Invoices</h2>
      {invoices.length === 0 ? (
        <p className="text-muted">No invoices yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const p = inv.member_id ? byId.get(inv.member_id) : undefined;
                return (
                  <tr key={inv.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">{inv.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{memberLabel(p)}</td>
                    <td className="px-4 py-3 text-muted">{inv.description ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(inv.created_at)}</td>
                    <td className="px-4 py-3 text-muted">{money(inv.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{inv.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {inv.status === "paid" ? (
                        <ReceiptDownload
                          receipt={{
                            invoiceNumber: inv.invoice_number,
                            description: inv.description,
                            amountCents: inv.amount_cents,
                            paidAt: inv.paid_at ?? inv.created_at,
                            id: inv.id,
                            billedTo: memberLabel(p),
                          }}
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
