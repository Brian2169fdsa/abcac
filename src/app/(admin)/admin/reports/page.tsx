import { ReportsDashboard } from "@/components/admin/reports-dashboard";

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

      <ReportsDashboard />
    </>
  );
}
