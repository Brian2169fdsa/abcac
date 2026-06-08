/**
 * Admin overview — the command-center KPI row for the admin home. Each tile is
 * a stat linking to the relevant queue, mirroring the member dashboard's
 * KpiCard visual language. Pending-attention tiles get a gold accent and an
 * "action needed" sub-line so urgent counts pop at a glance.
 */
import Link from "next/link";

export type OverviewStat = {
  label: string;
  value: number;
  href: string;
  /** When true (typically count > 0) the tile is highlighted as needing action. */
  attention?: boolean;
  /** Optional sub-line under the value. */
  sub?: string;
};

function StatTile({ stat }: { stat: OverviewStat }) {
  return (
    <Link
      href={stat.href}
      className={`block rounded-xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${
        stat.attention ? "border-accent/50 bg-accent/5" : "border-line bg-surface"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold text-brand">{stat.value.toLocaleString("en-US")}</div>
      <div className="mt-1 text-sm text-muted">
        {stat.sub ?? (stat.attention ? "Action needed →" : "View →")}
      </div>
    </Link>
  );
}

export function AdminOverview({ stats }: { stats: OverviewStat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <StatTile key={stat.label} stat={stat} />
      ))}
    </div>
  );
}
