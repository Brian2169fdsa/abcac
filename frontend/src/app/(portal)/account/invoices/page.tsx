import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { PayInvoiceButton } from "@/components/pay-invoice-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

interface Invoice {
  id: string; invoice_number: string | null; description: string | null;
  amount_cents: number | null; status: string | null; paid_at: string | null; created_at: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function money(c: number | null) { return "$" + ((c ?? 0) / 100).toFixed(2); }

export default async function InvoicesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("invoices").select("*").eq("member_id", user!.id).order("created_at", { ascending: false });
  const invoices = (data as Invoice[]) ?? [];

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Invoices & Receipts" intro="View and pay invoices issued by ABCAC." />
      <Section compact>
        {invoices.length === 0 ? (
          <p className="text-muted">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">{inv.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{inv.description ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(inv.created_at)}</td>
                    <td className="px-4 py-3 text-muted">{money(inv.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{inv.status ?? "—"}</td>
                    <td className="px-4 py-3">{inv.status === "paid" ? `Paid ${fmt(inv.paid_at)}` : <PayInvoiceButton invoiceId={inv.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
