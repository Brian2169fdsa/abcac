import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AutomationQueue, type PendingRun } from "@/components/admin/automation-queue";
import { EscalatedQueue, type EscalatedRun } from "./escalated-queue";
import { SweepButton } from "./sweep-button";
import { StatusBadge, TierBadge, RUN_STATUSES, statusLabel } from "./status-badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface StagedAction {
  handler?: string;
  args?: Record<string, unknown>;
}

interface RunRow {
  id: string;
  created_at: string | null;
  workflow: string;
  entity_type: string | null;
  entity_id: string | null;
  member_id: string | null;
  tier: string | null;
  confidence: number | null;
  rule_version: string | null;
  staged_action: StagedAction | null;
  anomaly_flags: string[] | null;
  summary: string | null;
  status: string;
  resolved_at: string | null;
}

interface SearchParams {
  workflow?: string;
  status?: string;
  page?: string;
}

function fmt(d: string | null): string {
  return d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

function confidenceLabel(r: RunRow): string {
  if (r.confidence != null) return `${Math.round(r.confidence * 100)}%`;
  if (r.rule_version) return r.rule_version;
  return "—";
}

function historyHref(filters: { workflow: string; status: string }, page: number): string {
  const qs = new URLSearchParams();
  if (filters.workflow) qs.set("workflow", filters.workflow);
  if (filters.status) qs.set("status", filters.status);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/admin/automation?${s}#history` : "/admin/automation#history";
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default async function AdminAutomation({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const workflowFilter = (sp.workflow ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const sb = createSupabaseServerClient();

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Filtered, paginated run history (filters before order/range for typing).
  let historyBase = sb.from("automation_runs").select("*", { count: "exact" });
  if (workflowFilter) historyBase = historyBase.eq("workflow", workflowFilter);
  if (statusFilter) historyBase = historyBase.eq("status", statusFilter);
  const history = historyBase
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [
    { data: pendingData },
    { data: escalatedData },
    { data: historyData, count: historyCount },
    { count: todayCount },
    { count: pendingCount },
    { count: escalatedCount },
    { count: autoExec7d },
    { data: globalData },
    { data: configData },
  ] = await Promise.all([
    sb
      .from("automation_runs")
      .select("*")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false }),
    sb
      .from("automation_runs")
      .select("*")
      .eq("status", "escalated")
      .order("created_at", { ascending: false })
      .limit(50),
    history,
    sb
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    sb
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    sb
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "escalated"),
    sb
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "auto_executed")
      .gte("created_at", weekAgo),
    sb.from("automation_global").select("paused").eq("id", true).maybeSingle(),
    sb.from("automation_config").select("workflow,enabled").order("workflow", { ascending: true }),
  ]);

  const pendingRows = (pendingData as RunRow[]) ?? [];
  const escalatedRows = (escalatedData as RunRow[]) ?? [];
  const historyRows = (historyData as RunRow[]) ?? [];

  const paused = Boolean(globalData?.paused);
  const workflows = (configData as { workflow: string; enabled: boolean }[] | null) ?? [];
  const enabledCount = workflows.filter((w) => w.enabled).length;

  const total = historyCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = { workflow: workflowFilter, status: statusFilter };

  const pending: PendingRun[] = pendingRows.map((r) => ({
    id: r.id,
    workflow: r.workflow,
    summary: r.summary,
    confidence: r.confidence,
    anomaly_flags: r.anomaly_flags,
    member_id: r.member_id,
    created_at: r.created_at,
    handler: r.staged_action?.handler ?? null,
    args: r.staged_action?.args ?? null,
  }));

  const escalated: EscalatedRun[] = escalatedRows.map((r) => ({
    id: r.id,
    workflow: r.workflow,
    summary: r.summary,
    anomaly_flags: r.anomaly_flags,
    member_id: r.member_id,
    created_at: r.created_at,
  }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-muted">
            Decisions the automation engine staged for a human, plus a feed of what it has done on
            its own.
          </p>
        </div>
        <SweepButton />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {paused ? (
          <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
            Globally paused — no workflow will run
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
            Engine active
          </span>
        )}
        <Link
          href="/admin/automation/config"
          className="rounded-full bg-bg px-3 py-1 font-semibold text-brand hover:underline"
        >
          {enabledCount} of {workflows.length} workflows enabled → config
        </Link>
      </div>

      <div className="mt-4 mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Runs today" value={todayCount ?? 0} />
        <StatCard label="Pending approvals" value={pendingCount ?? 0} hint="waiting on a human" />
        <StatCard label="Escalations open" value={escalatedCount ?? 0} hint="need manual handling" />
        <StatCard label="Auto-executed" value={autoExec7d ?? 0} hint="last 7 days" />
      </div>

      <h2 className="mb-1 text-xl font-bold">Needs attention</h2>
      <p className="mb-4 text-muted">
        Proposals the engine wants you to approve before it runs the staged action, plus
        escalations it refused to act on.
      </p>
      <div className="mb-4">
        <AutomationQueue runs={pending} />
      </div>
      {escalated.length > 0 ? (
        <div className="mb-10">
          <EscalatedQueue runs={escalated} />
        </div>
      ) : (
        <div className="mb-10" />
      )}

      <h2 id="history" className="mb-1 text-xl font-bold">
        Run history
      </h2>
      <p className="mb-4 text-muted">Every evaluation the engine has recorded, newest first.</p>

      <form method="get" action="/admin/automation#history" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Workflow
          </span>
          <select
            name="workflow"
            defaultValue={workflowFilter}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">All workflows</option>
            {workflows.map((w) => (
              <option key={w.workflow} value={w.workflow}>
                {w.workflow}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Status
          </span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
        >
          Filter
        </button>
        {(workflowFilter || statusFilter) && (
          <Link href="/admin/automation#history" className="text-sm font-semibold text-brand hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Workflow</th>
              <th className="px-5 py-3">Tier</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Conf. / Rule</th>
              <th className="px-5 py-3">Summary</th>
              <th className="px-5 py-3">Member</th>
            </tr>
          </thead>
          <tbody>
            {historyRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted">
                  No automation runs match these filters.
                </td>
              </tr>
            ) : (
              historyRows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-muted">
                    <Link
                      href={`/admin/automation/runs/${r.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {fmt(r.created_at)}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-semibold">{r.workflow}</td>
                  <td className="px-5 py-3">
                    <TierBadge tier={r.tier} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted">
                    {confidenceLabel(r)}
                  </td>
                  <td className="max-w-md px-5 py-3 text-muted">{r.summary ?? "—"}</td>
                  <td className="px-5 py-3">
                    {r.member_id ? (
                      <Link
                        href={`/admin/members/${r.member_id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">
          Page {page} of {totalPages} · {total} run{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={historyHref(filters, page - 1)}
              className="rounded-lg border border-line px-4 py-2 font-semibold text-brand hover:bg-bg"
            >
              ← Prev
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={historyHref(filters, page + 1)}
              className="rounded-lg border border-line px-4 py-2 font-semibold text-brand hover:bg-bg"
            >
              Next →
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
