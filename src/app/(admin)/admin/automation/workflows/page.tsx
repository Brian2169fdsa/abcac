import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKFLOW_CATALOG } from "@/lib/automation/catalog";
import { getAutomationAnalytics, type WorkflowStat } from "@/lib/automation/analytics";
import { formatPercent, formatCompact } from "@/lib/format";
import { AutomationTabs } from "../automation-tabs";
import {
  buildEnabledMap,
  groupByCategory,
  CATEGORY_LABEL,
  CATEGORY_BLURB,
  CategoryChip,
  EnabledBadge,
  type ConfigRow,
} from "./workflow-bits";

export const dynamic = "force-dynamic";

// Workflows INDEX — every catalog workflow grouped by category, each row showing
// its enabled state plus a 30-day run count + automation rate. Per-workflow
// counts come from a single 30-day aggregate analytics snapshot
// (getAutomationAnalytics → workflowStats) indexed by workflow, so the whole
// table is one runs fetch rather than 16.

const WINDOW_DAYS = 30;

export default async function WorkflowsIndexPage() {
  const sb = createSupabaseServerClient();

  const [{ data: configData }, analytics] = await Promise.all([
    sb.from("automation_config").select("workflow,enabled").order("workflow", { ascending: true }),
    getAutomationAnalytics(sb, { days: WINDOW_DAYS }),
  ]);

  const enabledMap = buildEnabledMap(configData as ConfigRow[] | null);
  const statByWorkflow = new Map<string, WorkflowStat>(
    analytics.workflowStats.map((s) => [s.workflow, s]),
  );
  const groups = groupByCategory(WORKFLOW_CATALOG);

  return (
    <>
      <AutomationTabs />
      <h1 className="text-2xl font-bold">Workflows</h1>
      <p className="mb-6 text-muted">
        Every automation workflow, grouped by how it decides. Counts and automation rate cover the
        last {WINDOW_DAYS} days. Select a workflow to drill into its runs.
      </p>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.category}>
            <h2 className="mb-1 text-lg font-bold">{CATEGORY_LABEL[group.category]}</h2>
            <p className="mb-3 text-sm text-muted">{CATEGORY_BLURB[group.category]}</p>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Workflow</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Runs ({WINDOW_DAYS}d)</th>
                    <th className="px-5 py-3 text-right">Automation rate</th>
                  </tr>
                </thead>
                <tbody>
                  {group.workflows.map((m) => {
                    const stat = statByWorkflow.get(m.workflow);
                    const total = stat?.total ?? 0;
                    return (
                      <tr key={m.workflow} className="border-b border-line align-top last:border-0">
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/automation/workflows/${m.workflow}`}
                            className="font-semibold text-brand hover:underline"
                          >
                            {m.label}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <CategoryChip category={m.category} />
                            <span className="text-xs text-muted">{m.blurb}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <EnabledBadge enabled={enabledMap.get(m.workflow) ?? false} />
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">
                          {formatCompact(total)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted">
                          {total > 0 ? formatPercent(stat!.automationRate) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
