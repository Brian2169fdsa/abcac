import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: string;
  payment_submission_id: string | null;
  stripe_session_id: string | null;
  amount_cents: number | null;
  status: string | null;
  slug: string | null;
  product_name: string | null;
  created_at: string | null;
}

interface PaymentSubmissionRow {
  id: string;
  form_type: string;
  payer_first_name: string;
  payer_last_name: string;
  payer_email: string;
  product_name: string;
  status: string;
  created_at: string;
}

interface InvoiceRow {
  amount_cents: number | null;
  status: string | null;
  description: string | null;
  paid_at: string | null;
  created_at: string | null;
}

interface ProductStat {
  name: string;
  count: number;
  totalCents: number;
}

interface MonthStat {
  month: string; // "YYYY-MM"
  totalCents: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function money(cents: number): string {
  return (
    "$" +
    (cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function toYearMonth(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months; // most-recent first
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-bold">{children}</h2>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="font-display text-3xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminFinancePage() {
  const sb = createSupabaseServerClient();

  const [paymentsData, invoicesData, submissionsData] = await Promise.all([
    sb
      .from("payments")
      .select("id,payment_submission_id,stripe_session_id,amount_cents,status,slug,product_name,created_at")
      .order("created_at", { ascending: false }),
    sb
      .from("invoices")
      .select("amount_cents,status,paid_at,created_at,description"),
    sb
      .from("payment_submissions")
      .select("id,form_type,payer_first_name,payer_last_name,payer_email,product_name,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const payments = (paymentsData.data ?? []) as PaymentRow[];
  const invoices = (invoicesData.data ?? []) as InvoiceRow[];
  const submissions = (submissionsData.data ?? []) as PaymentSubmissionRow[];
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));

  // ── Stat computations ──────────────────────────────────────────────────────

  const paidPayments = payments.filter((p) => p.status === "paid");
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");
  const unpaidInvoices = invoices.filter((inv) => inv.status === "unpaid");

  const paymentRevenueCents = paidPayments.reduce(
    (s, p) => s + (p.amount_cents ?? 0),
    0
  );
  const invoiceRevenueCents = paidInvoices.reduce(
    (s, inv) => s + (inv.amount_cents ?? 0),
    0
  );
  const totalRevenueCents = paymentRevenueCents + invoiceRevenueCents;

  const paidTransactionCount = paidPayments.length + paidInvoices.length;

  const outstandingCents = unpaidInvoices.reduce(
    (s, inv) => s + (inv.amount_cents ?? 0),
    0
  );

  // ── Revenue by product ─────────────────────────────────────────────────────

  const productMap = new Map<string, ProductStat>();
  for (const p of paidPayments) {
    const name: string =
      (p.product_name !== null && p.product_name !== ""
        ? p.product_name
        : null) ??
      (p.slug !== null && p.slug !== "" ? p.slug : null) ??
      "Unknown";
    const existing = productMap.get(name);
    if (existing) {
      existing.count += 1;
      existing.totalCents += p.amount_cents ?? 0;
    } else {
      productMap.set(name, {
        name,
        count: 1,
        totalCents: p.amount_cents ?? 0,
      });
    }
  }
  const productStats: ProductStat[] = Array.from(productMap.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  // ── Revenue by month ───────────────────────────────────────────────────────

  const monthMap = new Map<string, number>();

  for (const p of paidPayments) {
    const ym = toYearMonth(p.created_at);
    if (ym) {
      monthMap.set(ym, (monthMap.get(ym) ?? 0) + (p.amount_cents ?? 0));
    }
  }
  for (const inv of paidInvoices) {
    const ym = toYearMonth(inv.paid_at ?? inv.created_at);
    if (ym) {
      monthMap.set(ym, (monthMap.get(ym) ?? 0) + (inv.amount_cents ?? 0));
    }
  }

  const months = last12Months();
  const monthStats: MonthStat[] = months.map((month) => ({
    month,
    totalCents: monthMap.get(month) ?? 0,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <h1 className="text-2xl font-bold">Financial Report</h1>
      <p className="mb-6 text-muted">
        Revenue, transactions, and outstanding balances across payments and
        invoices.
      </p>

      {/* ── Stat cards ── */}
      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total revenue (paid)" value={money(totalRevenueCents)} />
          <StatCard label="Paid transactions" value={paidTransactionCount} />
          <StatCard label="Outstanding (unpaid invoices)" value={money(outstandingCents)} />
        </div>
      </section>

      <section className="mb-8">
        <SectionHeading>Recent Stripe payments and attached forms</SectionHeading>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Payer</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Form</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">No Stripe payments recorded.</td></tr>
              ) : payments.slice(0, 25).map((payment) => {
                const submission = payment.payment_submission_id ? submissionById.get(payment.payment_submission_id) : undefined;
                return (
                  <tr key={payment.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <div>{submission ? `${submission.payer_first_name} ${submission.payer_last_name}` : "Form unavailable"}</div>
                      {submission && <div className="text-xs text-muted">{submission.payer_email}</div>}
                    </td>
                    <td className="px-5 py-3">{payment.product_name || payment.slug || "Payment"}</td>
                    <td className="px-5 py-3 text-muted">{submission?.form_type || "Missing"}</td>
                    <td className="px-5 py-3 tabular-nums">{money(payment.amount_cents ?? 0)}</td>
                    <td className="px-5 py-3 capitalize">{payment.status || "unknown"}</td>
                    <td className="px-5 py-3">
                      <Link className="font-semibold text-brand hover:underline" href={`/admin/finance/payments/${payment.id}`}>View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Revenue by product ── */}
      <section className="mb-8">
        <SectionHeading>Revenue by product</SectionHeading>
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Count</th>
                <th className="px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {productStats.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-muted">
                    No paid payment data.
                  </td>
                </tr>
              ) : (
                productStats.map((ps) => (
                  <tr key={ps.name} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">{ps.name}</td>
                    <td className="px-5 py-3 text-muted">{ps.count}</td>
                    <td className="px-5 py-3 tabular-nums">{money(ps.totalCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Revenue by month ── */}
      <section className="mb-8">
        <SectionHeading>Revenue by month (last 12 months)</SectionHeading>
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Month</th>
                <th className="px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {monthStats.map((ms) => (
                <tr key={ms.month} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 tabular-nums">{ms.month}</td>
                  <td className="px-5 py-3 tabular-nums">{money(ms.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
