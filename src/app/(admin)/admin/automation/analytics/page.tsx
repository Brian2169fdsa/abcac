// ABCAC — Automation Analytics dashboard (server component).
//
// Aggregates public.automation_runs over a 7/30/90-day window into impact KPIs,
// a daily runs-over-time series (rendered client-side with a lens toggle), a
// per-workflow breakdown, tier distribution, and the top escalation/anomaly
// reasons. Reads via the cookie-bound server client — admins can read the full
// automation_runs table under RLS (policy: admin_all_automation_runs USING
// is_admin()), exactly like the Automation console page; no service role needed.
// The admin layout already enforces the admin role, so there is no per-page auth.

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  StatCard,
  StatCardRow,
  DonutChart,
  formatCompact,
} from "@/components/agent/charts";
import {
  AnalyticsDashboard,
  ALLOWED_DAYS,
  clampDays,
  workflowLabel,
  workflowCategory,
  anomalyLabel,
  formatUsd,
  formatPercent,
  formatDuration,
  type AllowedDays,
  type DailyPoint,
  type WorkflowCategory,
} from "./analytics-dashboard";

export const dynamic = "force-dynamic";

const CATEGORY_TONE: Record<WorkflowCategory, string> = {
  Compliance: "bg-[#1F5FA8]/10 text-[#1F5FA8]",
  Billing: "bg-[#3E8E41]/10 text-[#3E8E41]",
  Documents: "bg-[#C8741F]/10 text-[#C8741F]",
  Other: "bg-muted/15 text-muted",
};

// ── Analytics computation ────────────────────────────────────────────────────

const AUTOMATED_STATUSES = new Set(["auto_executed", "approved"]);

/** Per-workflow minutes saved when the engine handled a decision (estimate). */
const MINUTES_PER_AUTOMATED_DECISION = 8;
/** Loaded staff cost per minute (estimate) used for "cost saved". */
const COST_PER_MINUTE = 0.85;

interface RunRow {
  created_at: string | null;
  workflow: string;
  tier: string | null;
  anomaly_flags: string[] | null;
  status: string;
}

interface WorkflowStat {
  workflow: string;
  runs: number;
  automated: number;
  escalated: number;
  failed: number;
  automationRate: number;
  minutesSaved: number;
}

interface ImpactSummary {
  automatedCount: number;
  minutesSaved: number;
  costSaved: number;
  automationRate: number;
}

interface AnomalyCount {
  reason: string;
  count: number;
}

interface TierCount {
  tier: string;
  count: number;
}

interface AutomationAnalytics {
  days: AllowedDays;
  totalRuns: number;
  impact: ImpactSummary;
  workflowStats: WorkflowStat[];
  daily: DailyPoint[];
  anomalies: AnomalyCount[];
  tiers: TierCount[];
}

/** ISO date key ("YYYY-MM-DD", UTC) for a timestamp. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

const TIER_LABEL: Record<string, string> = {
  auto: "Auto-executed",
  propose: "Proposed",
  escalate: "Escalated",
};

/** Build the full analytics view from raw rows + the requested window. */
function buildAnalytics(rows: RunRow[], days: AllowedDays): AutomationAnalytics {
  // Pre-seed one DailyPoint per day in the window so the chart has a continuous
  // axis even on quiet days.
  const dailyMap = new Map<string, DailyPoint>();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, total: 0, automated: 0, escalated: 0, failed: 0 });
  }

  const wf = new Map<string, WorkflowStat>();
  const tierMap = new Map<string, number>();
  const anomalyMap = new Map<string, number>();
  let automatedCount = 0;

  for (const r of rows) {
    const isAutomated = AUTOMATED_STATUSES.has(r.status);
    const isEscalated = r.status === "escalated";
    const isFailed = r.status === "failed";

    if (isAutomated) automatedCount++;

    // Daily series
    if (r.created_at) {
      const point = dailyMap.get(dayKey(r.created_at));
      if (point) {
        point.total++;
        if (isAutomated) point.automated++;
        if (isEscalated) point.escalated++;
        if (isFailed) point.failed++;
      }
    }

    // Per-workflow
    let stat = wf.get(r.workflow);
    if (!stat) {
      stat = {
        workflow: r.workflow,
        runs: 0,
        automated: 0,
        escalated: 0,
        failed: 0,
        automationRate: 0,
        minutesSaved: 0,
      };
      wf.set(r.workflow, stat);
    }
    stat.runs++;
    if (isAutomated) stat.automated++;
    if (isEscalated) stat.escalated++;
    if (isFailed) stat.failed++;

    // Tiers
    if (r.tier) tierMap.set(r.tier, (tierMap.get(r.tier) ?? 0) + 1);

    // Anomalies
    for (const flag of r.anomaly_flags ?? []) {
      anomalyMap.set(flag, (anomalyMap.get(flag) ?? 0) + 1);
    }
  }

  const workflowStats = Array.from(wf.values())
    .map((s) => ({
      ...s,
      automationRate: s.runs > 0 ? s.automated / s.runs : 0,
      minutesSaved: s.automated * MINUTES_PER_AUTOMATED_DECISION,
    }))
    .sort((a, b) => b.runs - a.runs);

  const totalRuns = rows.length;
  const minutesSaved = automatedCount * MINUTES_PER_AUTOMATED_DECISION;

  const tiers: TierCount[] = Array.from(tierMap.entries())
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => b.count - a.count);

  const anomalies: AnomalyCount[] = Array.from(anomalyMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    days,
    totalRuns,
    impact: {
      automatedCount,
      minutesSaved,
      costSaved: Math.round(minutesSaved * COST_PER_MINUTE),
      automationRate: totalRuns > 0 ? automatedCount / totalRuns : 0,
    },
    workflowStats,
    daily: Array.from(dailyMap.values()),
    anomalies,
    tiers,
  };
}

// ── Local tabs bar (admin automation sub-nav) ────────────────────────────────

const TABS = [
  { href: "/admin/automation", label: "Console" },
  { href: "/admin/automation/analytics", label: "Analytics" },
  { href: "/admin/automation/config", label: "Configuration" },
] as const;

function AutomationTabs({ active }: { active: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
      {TABS.map((t) => {
        const isActive = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              isActive
                ? "border-b-2 border-brand px-4 py-2 text-sm font-semibold text-brand"
                : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted hover:text-ink"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AutomationAnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string | string[] };
}) {
  const days = clampDays(searchParams.days);

  const sb = createSupabaseServerClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await sb
    .from("automation_runs")
    .select("created_at, workflow, tier, anomaly_flags, status")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const rows = (data as RunRow[] | null) ?? [];
  const analytics = buildAnalytics(rows, days);
  const { impact, workflowStats, daily, tiers, anomalies, totalRuns } = analytics;

  const tierDonut = tiers.map((t) => ({ label: TIER_LABEL[t.tier] ?? t.tier, value: t.count }));
  const maxAnomaly = Math.max(...anomalies.map((a) => a.count), 1);

  return (
    <>
      <AutomationTabs active="/admin/automation/analytics" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Automation Analytics</h1>
          <p className="mt-1 text-muted">
            What the automation engine handled over the last {days} days — impact, volume, and where
            it asked for a human.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {ALLOWED_DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin/automation/analytics?days=${d}`}
              className={
                d === days
                  ? "rounded-md bg-ink px-3 py-1 text-sm font-semibold text-white"
                  : "rounded-md px-3 py-1 text-sm font-medium text-muted hover:text-ink"
              }
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {/* Impact KPIs */}
      <div className="mb-8">
        <StatCardRow>
          <StatCard label="Decisions automated" value={formatCompact(impact.automatedCount)} />
          <StatCard label="Time saved" value={formatDuration(impact.minutesSaved)} />
          <StatCard label="Est. cost saved" value={formatUsd(impact.costSaved)} />
          <StatCard label="Automation rate" value={formatPercent(impact.automationRate)} />
        </StatCardRow>
      </div>

      {/* Runs over time */}
      <section className="mb-8 rounded-xl border border-line bg-surface p-5">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Runs over time</h2>
          <p className="text-sm text-muted">Daily run volume — switch the lens to focus a series.</p>
        </div>
        {totalRuns === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-12 text-center text-sm text-muted">
            No automation runs in this window yet.
          </div>
        ) : (
          <AnalyticsDashboard daily={daily} />
        )}
      </section>

      {/* Per-workflow table */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">By workflow</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Workflow</th>
                <th className="px-5 py-3 text-right">Runs</th>
                <th className="px-5 py-3 text-right">Automated</th>
                <th className="px-5 py-3 text-right">Escalated</th>
                <th className="px-5 py-3 text-right">Failed</th>
                <th className="px-5 py-3 text-right">Automation rate</th>
                <th className="px-5 py-3 text-right">Time saved</th>
              </tr>
            </thead>
            <tbody>
              {workflowStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted">
                    No workflow activity in this window.
                  </td>
                </tr>
              ) : (
                workflowStats.map((s) => (
                  <tr key={s.workflow} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/automation/workflows/${s.workflow}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {workflowLabel(s.workflow)}
                      </Link>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_TONE[workflowCategory(s.workflow)]}`}
                      >
                        {workflowCategory(s.workflow)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.runs.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.automated.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.escalated.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.failed.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatPercent(s.automationRate)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatDuration(s.minutesSaved)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tier distribution + top anomaly reasons */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-lg font-bold">Tier distribution</h2>
          {tierDonut.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-10 text-center text-sm text-muted">
              No tiered runs yet.
            </div>
          ) : (
            <DonutChart
              data={tierDonut}
              centerLabel={formatCompact(totalRuns)}
              centerSub="runs"
              format={formatCompact}
            />
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-4 text-lg font-bold">Top escalation reasons</h2>
          {anomalies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-10 text-center text-sm text-muted">
              No anomalies flagged in this window.
            </div>
          ) : (
            <ul className="space-y-3">
              {anomalies.slice(0, 8).map((a) => (
                <li key={a.reason}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{anomalyLabel(a.reason)}</span>
                    <span className="tabular-nums text-muted">{a.count.toLocaleString("en-US")}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-[#C0432F]"
                      style={{ width: `${Math.max(4, (a.count / maxAnomaly) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
