import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { PayInvoiceButton } from "@/components/pay-invoice-button";
import { ReceiptDownload } from "@/components/receipt-download";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InvoicesStatusChip } from "@/components/account/invoices-status-chip";

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

  const openInvoices = invoices.filter((inv) => !isPaid(inv.status));
  const amountDue = openInvoices.reduce((s, inv) => s + (inv.amount_cents ?? 0), 0);
  const totalPaid =
    invoices.filter((inv) => isPaid(inv.status)).reduce((s, inv) => s + (inv.amount_cents ?? 0), 0) +
    payments.filter((p) => isPaid(p.status)).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Invoices & Receipts" intro="View and pay invoices issued by ABCAC, and download receipts for completed payments." />
      <Section compact>
        {/* Summary stat tiles */}
        <div className="mb-6 grid gap-5 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Amount due</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{money(amountDue)}</div>
            <div className="mt-2 text-sm text-muted">{openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total paid</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{money(totalPaid)}</div>
            <div className="mt-2 text-sm text-muted">across invoices &amp; payments</div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Invoices on file</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{invoices.length}</div>
            <div className="mt-2 text-sm text-muted">{payments.length} payment{payments.length !== 1 ? "s" : ""} recorded</div>
          </div>
        </div>

        <h2 className="mb-3 font-display text-lg font-bold text-ink">Invoices</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-bg px-5 py-10 text-center text-sm text-muted">
            No invoices yet. Any charges issued by ABCAC will appear here for payment and receipts.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{inv.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{inv.description ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(inv.created_at)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{money(inv.amount_cents)}</td>
                    <td className="px-4 py-3"><InvoicesStatusChip status={inv.status} /></td>
                    <td className="px-4 py-3">
                      {isPaid(inv.status) ? (
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-xs text-muted">Paid {fmt(inv.paid_at)}</span>
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
                        <div className="flex justify-end">
                          <PayInvoiceButton invoiceId={inv.id} />
                        </div>
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
            <h2 className="mb-3 mt-10 font-display text-lg font-bold text-ink">Payments</h2>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Description</th><th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink">{p.product_name ?? "Payment"}</td>
                      <td className="px-4 py-3 text-muted">{fmt(p.created_at)}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{money(p.amount_cents)}</td>
                      <td className="px-4 py-3"><InvoicesStatusChip status={p.status} /></td>
                      <td className="px-4 py-3">
                        {isPaid(p.status) ? (
                          <div className="flex justify-end">
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
                          </div>
                        ) : (
                          <div className="flex justify-end text-muted">—</div>
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
