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
import { BarChart, ChartToggle, formatCompact } from "@/components/agent/charts";
import {
  LENSES,
  coerceLens,
  lensSeries,
  type DailyPoint,
  type Lens,
} from "./analytics-shared";

// Pure window/lens helpers moved to ./analytics-shared (server-safe). Re-export
// them so existing imports + unit tests that reach for them here keep working.
export {
  ALLOWED_DAYS,
  DEFAULT_DAYS,
  LENSES,
  clampDays,
  coerceLens,
  shortDateLabel,
  lensSeries,
} from "./analytics-shared";
export type { AllowedDays, Lens, DailyPoint } from "./analytics-shared";

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
