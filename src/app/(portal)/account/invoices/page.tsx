import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { PayInvoiceButton } from "@/components/pay-invoice-button";
import { ReceiptDownload } from "@/components/receipt-download";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

interface Invoice {
  id: string; invoice_number: string | null; description: string | null;
  amount_cents: number | null; status: string | null; paid_at: string | null; created_at: string | null;
}
interface Payment {
  id: string; product_name: string | null; amount_cents: number | null;
  status: string | null; created_at: string | null; stripe_session_id: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function money(c: number | null) { return "$" + ((c ?? 0) / 100).toFixed(2); }
function isPaid(status: string | null) { return status === "paid"; }

export default async function InvoicesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: invData }, { data: payData }, { data: profData }] = await Promise.all([
    supabase.from("invoices").select("*").eq("member_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("id,product_name,amount_cents,status,created_at,stripe_session_id").eq("member_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("first_name,last_name,email").eq("id", user!.id).maybeSingle(),
  ]);

  const invoices = (invData as Invoice[]) ?? [];
  const payments = (payData as Payment[]) ?? [];
  const prof = (profData as { first_name: string | null; last_name: string | null; email: string | null } | null) ?? null;
  const billedTo = prof
    ? ([prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.email || "")
    : "";

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Invoices & Receipts" intro="View and pay invoices issued by ABCAC, and download receipts for completed payments." />
      <Section compact>
        <h2 className="mb-3 text-lg font-semibold text-ink">Invoices</h2>
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
                    <td className="px-4 py-3">
                      {isPaid(inv.status) ? (
                        <div className="flex items-center gap-3">
                          <span className="text-muted">Paid {fmt(inv.paid_at)}</span>
                          <ReceiptDownload
                            receipt={{
                              invoiceNumber: inv.invoice_number,
                              description: inv.description,
                              amountCents: inv.amount_cents,
                              paidAt: inv.paid_at ?? inv.created_at,
                              id: inv.id,
                              billedTo,
                            }}
                          />
                        </div>
                      ) : (
                        <PayInvoiceButton invoiceId={inv.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {payments.length > 0 && (
          <>
            <h2 className="mb-3 mt-10 text-lg font-semibold text-ink">Payments</h2>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-ink">{p.product_name ?? "Payment"}</td>
                      <td className="px-4 py-3 text-muted">{fmt(p.created_at)}</td>
                      <td className="px-4 py-3 text-muted">{money(p.amount_cents)}</td>
                      <td className="px-4 py-3 capitalize text-muted">{p.status ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isPaid(p.status) ? (
                          <ReceiptDownload
                            receipt={{
                              invoiceNumber: p.stripe_session_id,
                              description: p.product_name,
                              amountCents: p.amount_cents,
                              paidAt: p.created_at,
                              id: p.id,
                              billedTo,
                            }}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
