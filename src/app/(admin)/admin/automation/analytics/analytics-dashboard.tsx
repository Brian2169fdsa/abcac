"use client";

// ABCAC — Automation Analytics: interactive "runs over time" chart.
//
// The server page computes the daily series (via src/lib/automation/analytics)
// and hands it down as plain data; this client island owns only the lens toggle
// (Total / Automated / Escalated / Failed) over the shared BarChart primitive.
// The window/lens helpers below live here (a page file may only export a default
// + reserved fields) and are exported so they can be unit-tested without a DOM.
// Workflow labels and value formatting come from the shared libs — not redefined.

import { useState } from "react";
import { BarChart, ChartToggle, formatCompact, type BarDatum } from "@/components/agent/charts";
import type { DailyPoint } from "@/lib/automation/analytics";

export type { DailyPoint };

// ── Window selection ─────────────────────────────────────────────────────────

export const ALLOWED_DAYS = [7, 30, 90] as const;
export type AllowedDays = (typeof ALLOWED_DAYS)[number];
export const DEFAULT_DAYS: AllowedDays = 30;

/** Clamp an arbitrary `?days=` value to the allowed set; default 30. */
export function clampDays(value: string | string[] | number | null | undefined): AllowedDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  return (ALLOWED_DAYS as readonly number[]).includes(n) ? (n as AllowedDays) : DEFAULT_DAYS;
}

// ── Lenses (pure helpers, exported for unit tests) ───────────────────────────

export const LENSES = ["Total", "Automated", "Escalated", "Failed"] as const;
export type Lens = (typeof LENSES)[number];

const LENS_FIELD: Record<Lens, keyof Omit<DailyPoint, "date">> = {
  Total: "total",
  Automated: "automated",
  Escalated: "escalated",
  Failed: "failed",
};

/** A safe Lens from arbitrary input (e.g. a `?lens=` param); defaults to Total. */
export function coerceLens(value: string | null | undefined): Lens {
  return (LENSES as readonly string[]).includes(value ?? "") ? (value as Lens) : "Total";
}

/**
 * Format an ISO date ("2026-06-04") as a short axis label ("Jun 4"). Parsed as
 * UTC so the label never drifts by a day across timezones.
 */
export function shortDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Project the daily series onto a single lens, as BarChart data. */
export function lensSeries(daily: DailyPoint[], lens: Lens): BarDatum[] {
  const field = LENS_FIELD[lens];
  return daily.map((d) => ({ label: shortDateLabel(d.date), value: d[field] ?? 0 }));
}

// ── Component ────────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ daily }: { daily: DailyPoint[] }) {
  const [lens, setLens] = useState<Lens>("Total");
  const data = lensSeries(daily, lens);
  const hasData = data.some((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <ChartToggle options={[...LENSES]} value={lens} onChange={(v) => setLens(coerceLens(v))} />
      {hasData ? (
        <BarChart
          data={data}
          height={260}
          format={formatCompact}
          showLegend={false}
          rotateLabels={data.length > 14}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-10 text-center text-sm text-muted">
          No {lens.toLowerCase()} runs in this window.
        </div>
      )}
    </div>
  );
}
