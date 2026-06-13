// ABCAC — Automation Analytics dashboard (server component).
//
// Aggregates public.automation_runs over a 7/30/90-day window into impact KPIs,
// a daily runs-over-time series (rendered client-side with a lens toggle), a
// per-workflow breakdown, tier distribution, and the top escalation/anomaly
// reasons. Reads via the cookie-bound server client — admins read the full
// automation_runs table under RLS (policy admin_all_automation_runs), like the
// Automation console page; the admin layout already enforces the admin role.
// All aggregation + tunables come from src/lib/automation/{analytics,catalog}.

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAutomationAnalytics } from "@/lib/automation/analytics";
import { workflowLabel, workflowMeta, type WorkflowCategory } from "@/lib/automation/catalog";
import { formatUsd, formatPercent, formatDuration, formatCompact } from "@/lib/format";
import { StatCard, StatCardRow, DonutChart } from "@/components/agent/charts";
import { AutomationTabs } from "../automation-tabs";
import { AnalyticsDashboard } from "./analytics-dashboard";
import { ALLOWED_DAYS, clampDays } from "./analytics-shared";

export const dynamic = "force-dynamic";

const CATEGORY_TONE: Record<WorkflowCategory, string> = {
  deterministic: "bg-[#1F5FA8]/10 text-[#1F5FA8]",
  agent: "bg-[#6D28D9]/10 text-[#6D28D9]",
  human_gate: "bg-[#C0432F]/10 text-[#C0432F]",
  observational: "bg-muted/15 text-muted",
};

const CATEGORY_LABEL: Record<WorkflowCategory, string> = {
  deterministic: "Deterministic",
  agent: "Agent",
  human_gate: "Human gate",
  observational: "Observational",
};

const TIER_LABEL: Record<string, string> = {
  auto: "Auto-executed",
  propose: "Proposed",
  escalate: "Escalated",
};

/** Humanize an anomaly flag ("ambiguous_match" → "Ambiguous match"). */
function anomalyLabel(flag: string): string {
  return flag
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function categoryChip(workflow: string) {
  const cat = workflowMeta(workflow)?.category ?? "deterministic";
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_TONE[cat]}`}>
      {CATEGORY_LABEL[cat]}
    </span>
  );
}

export default async function AutomationAnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string | string[] };
}) {
  const days = clampDays(searchParams.days);
  const sb = createSupabaseServerClient();
  const analytics = await getAutomationAnalytics(sb, { days });
  const { impact, workflowStats, daily, tiers, anomalies, totalRuns } = analytics;

  const tierDonut = tiers.map((t) => ({ label: TIER_LABEL[t.tier] ?? t.tier, value: t.count }));
  const maxAnomaly = Math.max(...anomalies.map((a) => a.count), 1);

  return (
    <>
      <AutomationTabs />

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
          <StatCard label="Staff time saved" value={formatDuration(impact.minutesSaved)} />
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
                      {categoryChip(s.workflow)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.total.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{s.automatedCount.toLocaleString("en-US")}</td>
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
            <DonutChart data={tierDonut} centerLabel={formatCompact(totalRuns)} centerSub="runs" />
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
                <li key={a.flag}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{anomalyLabel(a.flag)}</span>
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
