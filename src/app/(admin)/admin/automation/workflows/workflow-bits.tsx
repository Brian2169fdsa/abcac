// ABCAC — shared presentational helpers + pure logic for the Workflows index
// and per-workflow drilldown. The pure helpers (category grouping, days clamp,
// enabled-map builder, the "explanatory note vs stats" decision, recent-run row
// mapper) are exported standalone so they can be unit-tested without rendering
// the server pages.

import Link from "next/link";
import {
  WORKFLOW_CATALOG,
  type WorkflowCategory,
  type WorkflowMeta,
} from "@/lib/automation/catalog";
import { formatDateTime } from "@/lib/format";
import { StatusBadge, TierBadge } from "../status-badge";

// ── Pure helpers (exported for unit tests) ───────────────────────────────────

/** Display order + heading copy for the four workflow categories. */
export const CATEGORY_ORDER: WorkflowCategory[] = [
  "deterministic",
  "agent",
  "human_gate",
  "observational",
];

export const CATEGORY_LABEL: Record<WorkflowCategory, string> = {
  deterministic: "Deterministic",
  agent: "Agent-evaluated",
  human_gate: "Human gate",
  observational: "Observational",
};

export const CATEGORY_BLURB: Record<WorkflowCategory, string> = {
  deterministic: "Rule-driven decisions that auto-execute or escalate on clear signals.",
  agent: "Model-evaluated proposals, gated by confidence thresholds.",
  human_gate: "Always routes to a human — automation rate is 0 by design.",
  observational: "Mirrors existing sends into run history; takes no new action.",
};

export interface CategoryGroup {
  category: WorkflowCategory;
  workflows: WorkflowMeta[];
}

/**
 * Group the catalog by category in the fixed display order, preserving each
 * workflow's catalog order within its group. Empty categories are omitted.
 */
export function groupByCategory(catalog: WorkflowMeta[] = WORKFLOW_CATALOG): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    workflows: catalog.filter((m) => m.category === category),
  })).filter((g) => g.workflows.length > 0);
}

/** Clamp/normalize a `?days=` value to one of the allowed ranges (default 30). */
export const DAYS_OPTIONS = [7, 30, 90] as const;

export function clampDays(raw: string | string[] | undefined, fallback = 30): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return (DAYS_OPTIONS as readonly number[]).includes(rounded) ? rounded : fallback;
}

export interface ConfigRow {
  workflow: string;
  enabled: boolean;
}

/** Build a workflow → enabled lookup from fetched automation_config rows. */
export function buildEnabledMap(rows: ConfigRow[] | null | undefined): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const r of rows ?? []) {
    if (r && typeof r.workflow === "string") map.set(r.workflow, Boolean(r.enabled));
  }
  return map;
}

/**
 * Whether a workflow that shows 0 automation should display an explanatory note
 * rather than read as "underperforming". True for the by-design categories
 * (human_gate always escalates, observational never acts).
 */
export function isZeroAutomationByDesign(category: WorkflowCategory): boolean {
  return category === "human_gate" || category === "observational";
}

/** Explanatory copy for a by-design zero-automation category (null otherwise). */
export function automationNote(category: WorkflowCategory): string | null {
  switch (category) {
    case "human_gate":
      return "This is a permanent human gate — every run escalates to staff by design, so a 0% automation rate is expected, not a regression.";
    case "observational":
      return "This workflow only mirrors existing sends into run history for visibility — it takes no new action, so it has no automation rate.";
    default:
      return null;
  }
}

export interface RawRunRow {
  id: string;
  created_at: string | null;
  status: string;
  tier: string | null;
  summary: string | null;
  member_id: string | null;
}

export interface RecentRunRow {
  id: string;
  when: string;
  status: string;
  tier: string | null;
  summary: string;
  memberId: string | null;
  href: string;
}

/** Map a raw automation_runs row into the shape the recent-runs table renders. */
export function mapRecentRun(row: RawRunRow): RecentRunRow {
  return {
    id: row.id,
    when: formatDateTime(row.created_at),
    status: row.status,
    tier: row.tier,
    summary: row.summary?.trim() ? row.summary : "—",
    memberId: row.member_id,
    href: `/admin/automation/runs/${row.id}`,
  };
}

// ── Presentational components ────────────────────────────────────────────────

const CATEGORY_CHIP_TONE: Record<WorkflowCategory, string> = {
  deterministic: "bg-[#1F5FA8]/10 text-[#1F5FA8]",
  agent: "bg-[#7A5BD0]/10 text-[#7A5BD0]",
  human_gate: "bg-[#C8741F]/10 text-[#C8741F]",
  observational: "bg-muted/15 text-muted",
};

export function CategoryChip({ category }: { category: WorkflowCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_CHIP_TONE[category]}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        enabled ? "bg-emerald-100 text-emerald-800" : "bg-bg text-muted"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

/** Recent-runs table shared by the drilldown (and reusable elsewhere). */
export function RecentRunsTable({ rows }: { rows: RecentRunRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3">When</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Tier</th>
            <th className="px-5 py-3">Summary</th>
            <th className="px-5 py-3">Member</th>
            <th className="px-5 py-3">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-muted">
                No runs recorded in this window.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-5 py-3 text-muted">{r.when}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-5 py-3">
                  <TierBadge tier={r.tier} />
                </td>
                <td className="px-5 py-3 text-muted">{r.summary}</td>
                <td className="px-5 py-3">
                  {r.memberId ? (
                    <Link
                      href={`/admin/members/${r.memberId}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      View
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3">
                  <Link href={r.href} className="font-semibold text-brand hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
