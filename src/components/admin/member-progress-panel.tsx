import type { ComplianceResult } from "@/lib/ceu-compliance";

export interface ProgressCert {
  cert_type?: string | null;
  status?: string | null;
  expiration_date?: string | null;
}

export interface ProgressApplication {
  app_type?: string | null;
  cert_type?: string | null;
  status?: string | null;
  submitted_at?: string | null;
}

function cap(s: string | null | undefined) {
  return (s ?? "—").replace(/_/g, " ");
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold text-ink">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/**
 * Cockpit panel: a compact "where this member stands" summary — certifications,
 * CEU progress (computed via ceu-compliance) and current application stage.
 */
export function MemberProgressPanel({
  certs,
  compliance,
  applications,
}: {
  certs: ProgressCert[];
  compliance: ComplianceResult;
  applications: ProgressApplication[];
}) {
  const activeCerts = certs.filter((c) => (c.status ?? "").toLowerCase() === "active");
  const primaryCert = activeCerts[0] ?? certs[0] ?? null;
  // Most recent application by submitted_at (page already sorts desc, but be safe).
  const currentApp = applications
    .slice()
    .sort((a, b) => {
      const aT = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bT = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bT - aT;
    })[0] ?? null;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Progress snapshot</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Certification"
          value={primaryCert ? cap(primaryCert.cert_type) : "None"}
          sub={
            primaryCert
              ? <span className="capitalize">{cap(primaryCert.status)}</span>
              : `${certs.length} on record`
          }
        />
        <Tile
          label="CEU progress"
          value={`${compliance.totalApproved} / ${compliance.requiredTotal} hrs`}
          sub={compliance.compliant ? "Compliant" : `${compliance.remaining} hrs remaining`}
        />
        <Tile
          label="Application"
          value={currentApp ? cap(currentApp.status) : "None"}
          sub={currentApp ? cap(currentApp.app_type) : "No active application"}
        />
      </div>

      {/* CEU progress bar + category breakdown */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Renewal compliance</span>
          <span>{compliance.percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full rounded-full ${compliance.compliant ? "bg-success" : "bg-brand"}`}
            style={{ width: `${compliance.percent}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            Ethics {compliance.ethics} / {compliance.requiredEthics}
          </span>
          <span>
            Cultural Diversity {compliance.cultural} / {compliance.requiredCultural}
          </span>
        </div>
      </div>
    </div>
  );
}
