import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

export default async function AdminReportsPage() {
  const sb = createSupabaseServerClient();
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 86400000);

  const [
    profilesData,
    certsData,
    ceuData,
    paymentsData,
    appsData,
  ] = await Promise.all([
    sb.from("profiles").select("account_status"),
    sb.from("certifications").select("status,cert_type"),
    sb.from("ceu_records").select("status,hours"),
    sb.from("payments").select("amount_cents,status"),
    sb.from("applications").select("status"),
  ]);

  // ── Members by account_status ──────────────────────────────────────────────
  const profiles = (profilesData.data ?? []) as Array<{ account_status: string | null }>;
  const memberCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    const key = p.account_status ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const memberTotal = profiles.length;

  // ── Credentials ────────────────────────────────────────────────────────────
  const certs = (certsData.data ?? []) as Array<{ status: string | null; cert_type: string | null }>;
  const certStatusCounts = certs.reduce<Record<string, number>>((acc, c) => {
    const key = c.status ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const certTypeCounts = certs.reduce<Record<string, number>>((acc, c) => {
    const key = c.cert_type ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  // ── CEU records ────────────────────────────────────────────────────────────
  const ceuRows = (ceuData.data ?? []) as Array<{ status: string | null; hours: number | null }>;
  const ceuPending = ceuRows.filter((r) => r.status === "pending").length;
  const ceuApproved = ceuRows.filter((r) => r.status === "approved").length;
  const ceuTotalHours = ceuRows
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + (r.hours ?? 0), 0);

  // ── Revenue ────────────────────────────────────────────────────────────────
  const payments = (paymentsData.data ?? []) as Array<{ amount_cents: number | null; status: string | null }>;
  const paidPayments = payments.filter((p) => p.status === "paid");
  const totalRevenueCents = paidPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const paymentCount = payments.length;

  // ── Applications by status ─────────────────────────────────────────────────
  const apps = (appsData.data ?? []) as Array<{ status: string | null }>;
  const appCounts = apps.reduce<Record<string, number>>((acc, a) => {
    const key = a.status ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mb-6 text-muted">Aggregate summaries across the platform. Download raw data as CSV below.</p>

      {/* ── Download buttons ── */}
      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href="/api/admin/export/members"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand bg-transparent px-5 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
        >
          Export members (CSV)
        </a>
        <a
          href="/api/admin/export/payments"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand bg-transparent px-5 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
        >
          Export payments (CSV)
        </a>
        <a
          href="/api/admin/export/expiring"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-brand bg-transparent px-5 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
        >
          Export expiring credentials (CSV)
        </a>
      </div>

      {/* ── Members by account_status ── */}
      <section className="mb-8">
        <SectionHeading>Members</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total members" value={memberTotal} />
          <StatCard label="Approved" value={memberCounts["approved"] ?? 0} />
          <StatCard label="Pending" value={memberCounts["pending"] ?? 0} />
          <StatCard label="Rejected" value={memberCounts["rejected"] ?? 0} />
        </div>
      </section>

      {/* ── Credentials ── */}
      <section className="mb-8">
        <SectionHeading>Credentials</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3 mb-4">
          <StatCard label="Active" value={certStatusCounts["active"] ?? 0} />
          <StatCard label="Pending" value={certStatusCounts["pending"] ?? 0} />
          <StatCard label="Expired" value={certStatusCounts["expired"] ?? 0} />
        </div>
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <div className="border-b border-line px-5 py-3 font-semibold">Counts by credential type</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Credential Type</th>
                <th className="px-5 py-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(certTypeCounts).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-muted">No credential data.</td>
                </tr>
              ) : (
                Object.entries(certTypeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <tr key={type} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">{type}</td>
                      <td className="px-5 py-3 text-muted">{count}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CEU Records ── */}
      <section className="mb-8">
        <SectionHeading>CEU Records</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending review" value={ceuPending} />
          <StatCard label="Approved" value={ceuApproved} />
          <StatCard label="Total approved hours" value={ceuTotalHours.toFixed(1)} />
        </div>
      </section>

      {/* ── Revenue ── */}
      <section className="mb-8">
        <SectionHeading>Revenue</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Total revenue (paid)" value={money(totalRevenueCents)} />
          <StatCard label="Total payment records" value={paymentCount} />
        </div>
      </section>

      {/* ── Applications by status ── */}
      <section className="mb-8">
        <SectionHeading>Applications</SectionHeading>
        {Object.keys(appCounts).length === 0 ? (
          <p className="text-muted">No application data.</p>
        ) : (
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(appCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <tr key={status} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 capitalize">{statusLabel(status)}</td>
                      <td className="px-5 py-3 text-muted">{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
