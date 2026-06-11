// ABCAC — pure helpers for the admin Renewals Pipeline page.
//
// Kept free of server-only imports (no next/headers, no supabase) so they can be
// unit-tested directly. The page (page.tsx) imports from here.

import {
  STAGE_META,
  type RenewalPipeline,
  type RenewalRow,
  type RenewalStage,
} from "@/lib/renewals";

/** The actionable pipeline stages, in display order. "current" is excluded. */
export const ACTIONABLE_STAGES: RenewalStage[] = [
  "lapsed",
  "upcoming",
  "invoiced",
  "paid_processing",
  "renewed",
];

export type StageFilter = RenewalStage | "all";

/** Parse + clamp the `?stage=` param to a valid actionable stage or "all". */
export function parseStageFilter(raw: string | string[] | undefined): StageFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (ACTIONABLE_STAGES as string[]).includes(value)) {
    return value as RenewalStage;
  }
  return "all";
}

/** Rows for the selected stage filter, preserving the lib's urgency ordering. */
export function rowsForStage(pipeline: RenewalPipeline, filter: StageFilter): RenewalRow[] {
  if (filter === "all") return pipeline.rows;
  return pipeline.byStage[filter];
}

/**
 * Tailwind text-color class for an expiration urgency:
 * - red (accent) when lapsed (negative) or within 14 days,
 * - amber when within 45 days,
 * - muted otherwise / unknown.
 */
export function urgencyColorClass(daysToExpiry: number | null): string {
  if (daysToExpiry == null) return "text-muted";
  if (daysToExpiry < 0 || daysToExpiry <= 14) return "text-accent";
  if (daysToExpiry <= 45) return "text-[#C8741F]";
  return "text-muted";
}

/** "in N days" / "N days ago" / "today" relative phrasing for an expiry delta. */
export function relativeDays(daysToExpiry: number | null): string {
  if (daysToExpiry == null) return "no date";
  if (daysToExpiry === 0) return "today";
  if (daysToExpiry > 0) {
    return daysToExpiry === 1 ? "in 1 day" : `in ${daysToExpiry} days`;
  }
  const past = Math.abs(daysToExpiry);
  return past === 1 ? "1 day ago" : `${past} days ago`;
}

/** Build the stage filter tab descriptors (key + label + count). */
export function stageTabs(
  pipeline: RenewalPipeline,
): { key: StageFilter; label: string; count: number }[] {
  return [
    { key: "all", label: "All", count: pipeline.rows.length },
    ...ACTIONABLE_STAGES.map((s) => ({
      key: s as StageFilter,
      label: STAGE_META[s].label,
      count: pipeline.counts[s],
    })),
  ];
}
