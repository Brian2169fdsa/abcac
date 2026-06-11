import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isKnownWorkflow, workflowMeta } from "@/lib/automation/catalog";
import { getWorkflowAnalytics } from "@/lib/automation/analytics";
import { formatDuration, formatPercent } from "@/lib/format";
import { StatCard, StatCardRow, BarChart, formatCompact, type BarDatum } from "@/components/agent/charts";
import { AutomationTabs } from "../../automation-tabs";
import {
  buildEnabledMap,
  clampDays,
  DAYS_OPTIONS,
  mapRecentRun,
  automationNote,
  isZeroAutomationByDesign,
  CategoryChip,
  EnabledBadge,
  RecentRunsTable,
  type ConfigRow,
  type RawRunRow,
} from "../workflow-bits";

export const dynamic = "force-dynamic";

// Per-workflow DRILLDOWN — stat cards, runs-over-time, anomaly reasons, and the
// 20 most-recent runs for one workflow over a 7/30/90-day window. Reuses the
// analytics compute layer (getWorkflowAnalytics) and the shared run badges.

const RECENT_RUN_LIMIT = 20;

/** Short "Jun 10" axis label for a YYYY-MM-DD daily bucket. */
function shortDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function WorkflowDrilldownPage({
  params,
  searchParams,
}: {
  params: { workflow: string };
  searchParams: { days?: string | string[] };
}) {
  const workflow = params.workflow;
  if (!isKnownWorkflow(workflow)) notFound();

  const meta = workflowMeta(workflow)!;
  const days = clampDays(searchParams?.days);
  const sb = createSupabaseServerClient();

  const [analytics, { data: configData }, { data: recentData }] = await Promise.all([
    getWorkflowAnalytics(sb, workflow, { days }),
    sb.from("automation_config").select("workflow,enabled").eq("workflow", workflow),
    sb
      .from("automation_runs")
      .select("id,created_at,status,tier,summary,member_id")
      .eq("workflow", workflow)
      .order("created_at", { ascending: false })
      .limit(RECENT_RUN_LIMIT),
  ]);

  const enabled = buildEnabledMap(configData as ConfigRow[] | null).get(workflow) ?? false;
  const stat = analytics.workflowStats[0];
  const runs = stat?.total ?? 0;
  const automated = stat?.automatedCount ?? 0;
  const automationRate = stat?.automationRate ?? 0;
  const escalated = stat?.escalated ?? 0;
  const minutesSaved = stat?.minutesSaved ?? 0;

  const recentRows = ((recentData as RawRunRow[] | null) ?? []).map(mapRecentRun);

  const dailyBars: BarDatum[] = analytics.daily.map((d) => ({
    label: shortDate(d.date),
    value: d.total,
  }));

  const note = isZeroAutomationByDesign(meta.category) ? automationNote(meta.category) : null;

  return (
    <>
      <AutomationTabs />

      <nav className="mb-3 text-sm text-muted">
        <Link href="/admin/automation/workflows" className="text-brand hover:underline">
          Workflows
        </Link>
        <span className="mx-1.5">/</span>
        <span>{meta.label}</span>
      </nav>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{meta.label}</h1>
        <CategoryChip category={meta.category} />
        <EnabledBadge enabled={enabled} />
        <Link
          href="/admin/automation/config"
          className="text-sm font-semibold text-brand hover:underline"
        >
          {enabled ? "Disable" : "Enable"} in config
        </Link>
      </div>
      <p className="mb-4 max-w-2xl text-muted">{meta.blurb}</p>

      {/* Range switcher */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Window:</span>
        {DAYS_OPTIONS.map((opt) => {
          const active = opt === days;
          return (
            <Link
              key={opt}
              href={`/admin/automation/workflows/${workflow}?days=${opt}`}
              className={
                "rounded-lg border px-3 py-1 text-[13px] font-medium transition-colors " +
                (active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink hover:border-ink/40")
              }
            >
              {opt}d
            </Link>
          );
        })}
      </div>

      {note && (
        <div className="mb-6 rounded-r-lg border-l-4 border-ink bg-ink/[0.04] px-4 py-3 text-sm leading-relaxed text-ink/90">
          {note}
        </div>
      )}

      <div className="mb-8">
        <StatCardRow>
          <StatCard label="Runs" value={formatCompact(runs)} sub={`last ${days} days`} />
          <StatCard
            label="Automated"
            value={formatCompact(automated)}
            sub={runs > 0 ? `${formatPercent(automationRate)} automation rate` : "—"}
          />
          <StatCard label="Escalated" value={formatCompact(escalated)} />
          <StatCard label="Time saved" value={formatDuration(minutesSaved)} sub="estimated" />
        </StatCardRow>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Runs over time</h2>
        {runs > 0 ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <BarChart data={dailyBars} showLegend={false} rotateLabels format={formatCompact} />
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-muted">
            No runs recorded in this window.
          </div>
        )}
      </section>

      {analytics.anomalies.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Top escalation / anomaly reasons</h2>
          <ol className="overflow-hidden rounded-xl border border-line bg-surface">
            {analytics.anomalies.map((a, i) => (
              <li
                key={a.flag}
                className="flex items-center justify-between border-b border-line px-5 py-3 text-sm last:border-0"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted">{i + 1}</span>
                  <span className="font-mono text-[13px]">{a.flag}</span>
                </span>
                <span className="font-semibold">{formatCompact(a.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Recent runs</h2>
        <RecentRunsTable rows={recentRows} />
      </section>
    </>
  );
}
