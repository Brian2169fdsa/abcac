"use client";

// ABCAC — AI Agent visualization KIT (the shared "look" contract).
//
// Screenshot-styled data-viz primitives used by the admin AI-Agent workspace and
// the member analytics panels: KPI stat cards, a vertical bar chart with axis
// gridlines + rotated labels + a color legend, a donut, pill chart-toggles, and
// the "big takeaway" insight callout. Deliberately framework-light (hand-rolled
// SVG/CSS, no chart dependency) so the palette and spacing match the reference
// exactly while still sitting on the warm ABCAC surface.
//
// Palette note: per design direction these dashboards use a multi-series data
// palette (blue/green/orange/…) rather than strict brand maroon — it reads as
// "analytics" and matches the reference. Structure/text stay on-brand (navy ink,
// warm bg, thin lines).

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Multi-series data palette (matches the reference analytics look). */
export const SERIES_COLORS = [
  "#1F5FA8", // blue
  "#3E8E41", // green
  "#C8741F", // orange
  "#5BAE5B", // light green
  "#7A5BD0", // purple
  "#C0432F", // red
  "#2C8C8C", // teal
  "#8A8F98", // gray
] as const;

export function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

// ── Pure helpers (exported for unit tests) ──────────────────────────────────

/** Round a max value up to a "nice" axis ceiling (50, 100, 250000, …). */
export function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / mag; // 1..10
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

/** Evenly spaced axis ticks from 0..niceCeil(max), inclusive. */
export function axisTicks(max: number, steps = 5): number[] {
  const top = niceCeil(max);
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push((top / steps) * i);
  return out;
}

/** Compact number: 1247 → "1,247"; 214600 → "215K"; 1.2e6 → "1.2M". */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

/** Compact money with a leading $. */
export function formatMoneyCompact(n: number): string {
  return `$${formatCompact(n)}`;
}

export interface DonutSegment {
  label: string;
  value: number;
  percent: number; // 0..100
  color: string;
  /** stroke-dasharray for a normalized circumference of 100. */
  dashArray: string;
  /** stroke-dashoffset for a normalized circumference of 100. */
  dashOffset: number;
}

/** Build donut ring segments (normalized to circumference 100). */
export function donutSegments(data: { label: string; value: number }[]): DonutSegment[] {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  let acc = 0;
  return data.map((d, i) => {
    const pct = (Math.max(0, d.value) / total) * 100;
    const seg: DonutSegment = {
      label: d.label,
      value: d.value,
      percent: pct,
      color: seriesColor(i),
      dashArray: `${pct} ${100 - pct}`,
      dashOffset: 25 - acc, // start at 12 o'clock
    };
    acc += pct;
    return seg;
  });
}

// ── StatCard (KPI tile) ──────────────────────────────────────────────────────

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  menu?: boolean;
}

export function StatCard({ label, value, sub, delta, trend = "flat", menu }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-[#2E7D5A]" : trend === "down" ? "text-[#C0432F]" : "text-muted";
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="text-[12px] font-medium text-muted">{label}</div>
        {menu && <div className="text-muted/60" aria-hidden>···</div>}
      </div>
      <div className="mt-1 font-display text-[28px] font-bold leading-none text-ink">{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {sub && <span className="text-[12px] text-muted">{sub}</span>}
      </div>
      {delta && <div className={cn("mt-1 text-[12px] font-semibold", trendColor)}>{delta}</div>}
    </div>
  );
}

export function StatCardRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

// ── ChartToggle (pill buttons) ───────────────────────────────────────────────

export function ChartToggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink hover:border-ink/40",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── BarChart (vertical, gridlines, rotated labels, legend) ───────────────────

export interface BarDatum {
  label: string;
  value: number;
  note?: string;
}

export function BarChart({
  data,
  height = 240,
  format = (n: number) => n.toLocaleString("en-US"),
  showLegend = true,
  rotateLabels = false,
}: {
  data: BarDatum[];
  height?: number;
  format?: (n: number) => string;
  showLegend?: boolean;
  rotateLabels?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = axisTicks(max).reverse(); // top → bottom
  const top = ticks[0] || 1;

  return (
    <div>
      {showLegend && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {data.map((d, i) => (
            <span key={d.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink/80">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: seriesColor(i) }} aria-hidden />
              {d.label} — {format(d.value)}
            </span>
          ))}
        </div>
      )}

      <div className="flex" style={{ height }}>
        {/* Y axis labels */}
        <div className="flex w-12 flex-col justify-between pr-2 text-right text-[11px] text-muted">
          {ticks.map((t, i) => (
            <span key={i} className="leading-none">{format(t)}</span>
          ))}
        </div>

        {/* Plot area */}
        <div className="relative flex-1">
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-line" />
            ))}
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-around gap-2 px-1">
            {data.map((d, i) => {
              const h = top > 0 ? Math.max(2, (d.value / top) * 100) : 0;
              return (
                <div key={d.label} className="group flex h-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[56px] rounded-t-sm transition-opacity hover:opacity-90"
                    style={{ height: `${h}%`, background: seriesColor(i) }}
                    title={`${d.label}: ${format(d.value)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X axis labels */}
      <div className="ml-12 flex justify-around gap-2 px-1 pt-2">
        {data.map((d) => (
          <span
            key={d.label}
            className={cn(
              "flex-1 text-center text-[11px] text-muted",
              rotateLabels && "origin-top -rotate-12 whitespace-nowrap",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── DonutChart ───────────────────────────────────────────────────────────────

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerSub,
  format = (n: number) => n.toLocaleString("en-US"),
}: {
  data: { label: string; value: number }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  format?: (n: number) => string;
}) {
  const segments = donutSegments(data);
  const radius = 100 / (2 * Math.PI); // so circumference = 100
  const cxy = 50;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx={cxy} cy={cxy} r={radius} fill="none" stroke="var(--line)" strokeWidth={thickness / (size / 100)} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={cxy}
              cy={cxy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness / (size / 100)}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
            />
          ))}
        </svg>
        {(centerLabel || centerSub) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel && <div className="font-display text-xl font-bold text-ink">{centerLabel}</div>}
            {centerSub && <div className="text-[11px] text-muted">{centerSub}</div>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 text-[13px] text-ink/85">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="font-medium">{s.label}</span>
            <span className="text-muted">{format(s.value)} · {Math.round(s.percent)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── InsightCallout (the "big takeaway") ──────────────────────────────────────

export function InsightCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-r-lg border-l-4 border-ink bg-ink/[0.04] px-4 py-3 text-[14px] leading-relaxed text-ink/90">
      {children}
    </div>
  );
}

// ── Small status / score pills ───────────────────────────────────────────────

export function ScoreChip({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 80 ? "bg-[#1F5FA8]/10 text-[#1F5FA8]" : score >= 60 ? "bg-[#C8741F]/10 text-[#C8741F]" : "bg-muted/15 text-muted";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold", tone)}>
      Score {score}{label ? ` · ${label}` : ""}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-[#2E7D5A]/12 text-[#2E7D5A]",
    pending: "bg-[#C8741F]/12 text-[#C8741F]",
    renewal_due: "bg-[#1F5FA8]/12 text-[#1F5FA8]",
    lapsed: "bg-[#C0432F]/12 text-[#C0432F]",
  };
  const labels: Record<string, string> = {
    active: "Active",
    pending: "Pending",
    renewal_due: "Renewal due",
    lapsed: "Lapsed",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone[status] ?? "bg-muted/15 text-muted")}>
      {labels[status] ?? status}
    </span>
  );
}

/** Stateful toggle wrapper: renders the right view by selected option. */
export function ToggleChart({
  options,
  initial,
  render,
}: {
  options: string[];
  initial?: string;
  render: (selected: string) => ReactNode;
}) {
  const [selected, setSelected] = useState(initial ?? options[0]);
  return (
    <div className="space-y-4">
      <ChartToggle options={options} value={selected} onChange={setSelected} />
      <div>{render(selected)}</div>
    </div>
  );
}
