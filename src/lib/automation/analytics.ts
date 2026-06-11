// ABCAC — automation ANALYTICS (aggregation over automation_runs).
//
// Pure, testable compute over a fetched window of runs, plus the thin fetch
// helper the analytics pages call. Aggregation runs in-app (board-scale volumes
// are small and the idx_automation_runs_queue index covers the status/workflow/
// created_at access path); if run volume ever grows this can move behind a SQL
// view without changing the page contracts. Everything keys off the status the
// dispatcher writes (see dispatch.ts) and the impact tunables in catalog.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MINUTES_SAVED_PER_DECISION,
  DEFAULT_MINUTES_SAVED,
  STAFF_HOURLY_RATE_USD,
  minutesSavedFor,
} from "./catalog";

export interface AnalyticsRunRow {
  workflow: string;
  status: string;
  tier: string | null;
  created_at: string | null;
  anomaly_flags: string[] | null;
  confidence: number | null;
}

/** A run resulted in a real automated write: auto-executed, or human-approved. */
const AUTOMATED_STATUSES = new Set(["auto_executed", "approved"]);

export interface WorkflowStat {
  workflow: string;
  total: number;
  autoExecuted: number;
  approved: number;
  pendingApproval: number;
  escalated: number;
  rejected: number;
  failed: number;
  /** auto-executed + human-approved — decisions that produced an action. */
  automatedCount: number;
  automationRate: number; // automatedCount / total (0 when total 0)
  escalationRate: number; // escalated / total
  failureRate: number; // failed / total
  minutesSaved: number;
}

export interface ImpactByWorkflow {
  workflow: string;
  automatedCount: number;
  minutesSaved: number;
}

export interface ImpactSummary {
  since: string;
  totalRuns: number;
  automatedCount: number;
  automationRate: number;
  minutesSaved: number;
  hoursSaved: number;
  costSaved: number;
  byWorkflow: ImpactByWorkflow[];
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  automated: number;
  escalated: number;
  failed: number;
}

export interface AnomalyCount {
  flag: string;
  count: number;
}

export interface TierCount {
  tier: string;
  count: number;
}

export interface AutomationAnalytics {
  since: string;
  days: number;
  totalRuns: number;
  impact: ImpactSummary;
  workflowStats: WorkflowStat[];
  daily: DailyPoint[];
  anomalies: AnomalyCount[];
  tiers: TierCount[];
}

const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Per-workflow status tallies, sorted by total volume descending. */
export function computeWorkflowStats(rows: AnalyticsRunRow[]): WorkflowStat[] {
  const byWf = new Map<string, WorkflowStat>();
  for (const r of rows) {
    let s = byWf.get(r.workflow);
    if (!s) {
      s = {
        workflow: r.workflow,
        total: 0,
        autoExecuted: 0,
        approved: 0,
        pendingApproval: 0,
        escalated: 0,
        rejected: 0,
        failed: 0,
        automatedCount: 0,
        automationRate: 0,
        escalationRate: 0,
        failureRate: 0,
        minutesSaved: 0,
      };
      byWf.set(r.workflow, s);
    }
    s.total += 1;
    switch (r.status) {
      case "auto_executed":
        s.autoExecuted += 1;
        break;
      case "approved":
        s.approved += 1;
        break;
      case "pending_approval":
      case "approving":
        s.pendingApproval += 1;
        break;
      case "escalated":
        s.escalated += 1;
        break;
      case "rejected":
        s.rejected += 1;
        break;
      case "failed":
        s.failed += 1;
        break;
      default:
        break;
    }
  }
  const out = Array.from(byWf.values());
  for (const s of out) {
    s.automatedCount = s.autoExecuted + s.approved;
    s.automationRate = rate(s.automatedCount, s.total);
    s.escalationRate = rate(s.escalated, s.total);
    s.failureRate = rate(s.failed, s.total);
    s.minutesSaved = s.automatedCount * minutesSavedFor(s.workflow);
  }
  out.sort((a, b) => b.total - a.total || a.workflow.localeCompare(b.workflow));
  return out;
}

/** Time/cost saved from automated decisions across the window. */
export function computeImpact(rows: AnalyticsRunRow[], since: string): ImpactSummary {
  const stats = computeWorkflowStats(rows);
  let automatedCount = 0;
  let minutesSaved = 0;
  const byWorkflow: ImpactByWorkflow[] = [];
  for (const s of stats) {
    if (s.automatedCount === 0) continue;
    automatedCount += s.automatedCount;
    minutesSaved += s.minutesSaved;
    byWorkflow.push({ workflow: s.workflow, automatedCount: s.automatedCount, minutesSaved: s.minutesSaved });
  }
  byWorkflow.sort((a, b) => b.minutesSaved - a.minutesSaved);
  const hoursSaved = minutesSaved / 60;
  return {
    since,
    totalRuns: rows.length,
    automatedCount,
    automationRate: rate(automatedCount, rows.length),
    minutesSaved,
    hoursSaved,
    costSaved: hoursSaved * STAFF_HOURLY_RATE_USD,
    byWorkflow,
  };
}

/**
 * Daily counts for the last `days` days (UTC), zero-filled so the series is
 * continuous for charting. `now` is injectable for deterministic tests.
 */
export function computeDaily(rows: AnalyticsRunRow[], days: number, now: Date = new Date()): DailyPoint[] {
  const series: DailyPoint[] = [];
  const index = new Map<string, DailyPoint>();
  // Anchor to UTC midnight of `now` so the last bucket is "today".
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = days - 1; i >= 0; i--) {
    const d = isoDay(new Date(end.getTime() - i * DAY_MS));
    const point: DailyPoint = { date: d, total: 0, automated: 0, escalated: 0, failed: 0 };
    series.push(point);
    index.set(d, point);
  }
  for (const r of rows) {
    if (!r.created_at) continue;
    const t = Date.parse(r.created_at);
    if (Number.isNaN(t)) continue;
    const point = index.get(isoDay(new Date(t)));
    if (!point) continue;
    point.total += 1;
    if (AUTOMATED_STATUSES.has(r.status)) point.automated += 1;
    else if (r.status === "escalated") point.escalated += 1;
    else if (r.status === "failed") point.failed += 1;
  }
  return series;
}

/** Most frequent anomaly flags across the window (top N). */
export function computeAnomalies(rows: AnalyticsRunRow[], topN = 10): AnomalyCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const flag of r.anomaly_flags ?? []) {
      if (!flag) continue;
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag))
    .slice(0, topN);
}

/** Distribution of runs across decision tiers. */
export function computeTiers(rows: AnalyticsRunRow[]): TierCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const tier = r.tier ?? "unknown";
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => b.count - a.count);
}

/** Combine every lens from a single fetched window of runs. */
export function analyzeRuns(
  rows: AnalyticsRunRow[],
  opts: { days: number; since: string; now?: Date },
): AutomationAnalytics {
  return {
    since: opts.since,
    days: opts.days,
    totalRuns: rows.length,
    impact: computeImpact(rows, opts.since),
    workflowStats: computeWorkflowStats(rows),
    daily: computeDaily(rows, opts.days, opts.now),
    anomalies: computeAnomalies(rows),
    tiers: computeTiers(rows),
  };
}

/** Fetch the run rows needed for analytics within the trailing window. */
export async function fetchRunsSince(
  admin: SupabaseClient,
  sinceIso: string,
  limit = 20000,
): Promise<AnalyticsRunRow[]> {
  const { data } = await admin
    .from("automation_runs")
    .select("workflow,status,tier,created_at,anomaly_flags,confidence")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AnalyticsRunRow[] | null) ?? [];
}

/** One-call analytics for the dashboard: fetch the window, then analyze. */
export async function getAutomationAnalytics(
  admin: SupabaseClient,
  opts: { days?: number } = {},
): Promise<AutomationAnalytics> {
  const days = opts.days ?? 30;
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const rows = await fetchRunsSince(admin, since);
  return analyzeRuns(rows, { days, since });
}

/** Analytics for a single workflow (drilldown pages reuse the compute layer). */
export async function getWorkflowAnalytics(
  admin: SupabaseClient,
  workflow: string,
  opts: { days?: number } = {},
): Promise<AutomationAnalytics & { workflow: string }> {
  const days = opts.days ?? 30;
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data } = await admin
    .from("automation_runs")
    .select("workflow,status,tier,created_at,anomaly_flags,confidence")
    .eq("workflow", workflow)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);
  const rows = (data as AnalyticsRunRow[] | null) ?? [];
  return { workflow, ...analyzeRuns(rows, { days, since }) };
}

export { MINUTES_SAVED_PER_DECISION, DEFAULT_MINUTES_SAVED, STAFF_HOURLY_RATE_USD };
