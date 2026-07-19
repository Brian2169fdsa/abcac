import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { adminReportsDashboardEnabled } from "@/lib/feature-flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/catalog";
import { buildReportsData, type CertRow, type PaymentRow, type ReportsData } from "@/lib/admin-reports";

export const dynamic = "force-dynamic";

type Sb = ReturnType<typeof createSupabaseServerClient>;

const exportBtn =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand bg-transparent px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white";

async function countOf(sb: Sb, table: string, build?: (q: any) => any) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Fetch the raw rows + queue counts and shape them for the dashboard. */
async function loadReportsData(): Promise<ReportsData> {
  const sb = createSupabaseServerClient();

  const [certsRes, paymentsRes, totalMembers, approvedMembers, pendingApprovals, pendingCeus] = await Promise.all([
    sb.from("certifications").select("issued_date,cert_type,status").limit(20000),
    sb.from("payments").select("created_at,amount_cents,slug,product_name,status").limit(20000),
    countOf(sb, "profiles"),
    countOf(sb, "profiles", (q) => q.eq("account_status", "approved")),
    countOf(sb, "profiles", (q) => q.eq("account_status", "pending").not("account_submitted_at", "is", null)),
    countOf(sb, "ceu_records", (q) => q.eq("status", "pending")),
  ]);

  return buildReportsData({
    certs: (certsRes.data ?? []) as CertRow[],
    payments: (paymentsRes.data ?? []) as PaymentRow[],
    products: getProducts(),
    counts: { totalMembers, approvedMembers, pendingApprovals, pendingCeus },
  });
}

export default async function AdminReportsPage() {
  const data = adminReportsDashboardEnabled ? await loadReportsData() : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-1 text-muted">
            Certification &amp; revenue analytics — switch lenses to pivot the view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export/members" className={exportBtn}>Members CSV</a>
          <a href="/api/admin/export/payments" className={exportBtn}>Payments CSV</a>
          <a href="/api/admin/export/expiring" className={exportBtn}>Expiring CSV</a>
        </div>
      </div>

      {data ? (
        <ReportsDashboard data={data} />
      ) : (
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
              Live dashboard in preparation
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-ink">
              Verified exports are available now
            </h2>
            <p className="mt-2 leading-7 text-muted">
              The visual analytics workspace stays hidden until every chart is connected to production data. Use the CSV exports above for current member, payment, and expiration records.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
