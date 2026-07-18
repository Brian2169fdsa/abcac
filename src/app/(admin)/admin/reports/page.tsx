import { ReportsDashboard } from "@/components/admin/reports-dashboard";
import { adminReportsDashboardEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const exportBtn =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand bg-transparent px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white";

export default function AdminReportsPage() {
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

      {adminReportsDashboardEnabled ? (
        <ReportsDashboard />
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
