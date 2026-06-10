"use client";

/**
 * Visualization kit for agent dashboards.
 * All chart components are pure presentational — no data fetching.
 * Uses Tailwind brand tokens; chart colors use a multi-series palette
 * (intentionally NOT forced to brand maroon so charts remain readable).
 */

import React from "react";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatMoneyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

// ── Multi-series palette (HSL classes) ────────────────────────────────────

const PALETTE = [
  "#4f7fff", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#14b8a6", // teal
  "#f43f5e", // rose
  "#64748b", // slate
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface Datum {
  label: string;
  value: number;
  note?: string;
}

// ── StatCard & StatCardRow ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

interface StatCardRowProps {
  children: React.ReactNode;
  className?: string;
}

export function StatCardRow({ children, className }: StatCardRowProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

// ── ScoreChip ──────────────────────────────────────────────────────────────

interface ScoreChipProps {
  score: number;          // 0–100
  label?: string;
  size?: "sm" | "md";
}

export function ScoreChip({ score, label, size = "md" }: ScoreChipProps) {
  const color =
    score >= 80 ? "border-success/40 bg-success/10 text-success"
    : score >= 50 ? "border-amber-400/50 bg-amber-50 text-amber-700"
    : "border-accent/50 bg-accent/10 text-accent-strong";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        color,
      )}
    >
      {score}
      {label && <span className="font-normal opacity-70">{label}</span>}
    </span>
  );
}

// ── StatusPill ─────────────────────────────────────────────────────────────

type PillVariant = "success" | "warning" | "error" | "info" | "neutral";

const PILL_STYLES: Record<PillVariant, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-amber-400/50 bg-amber-50 text-amber-700",
  error: "border-accent/50 bg-accent/10 text-accent-strong",
  info: "border-info/40 bg-info/10 text-info",
  neutral: "border-line bg-surface text-muted",
};

interface StatusPillProps {
  label: string;
  variant?: PillVariant;
}

export function StatusPill({ label, variant = "neutral" }: StatusPillProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", PILL_STYLES[variant])}>
      {label}
    </span>
  );
}

// ── InsightCallout ─────────────────────────────────────────────────────────

interface InsightCalloutProps {
  children: React.ReactNode;
  className?: string;
}

export function InsightCallout({ children, className }: InsightCalloutProps) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border border-info/30 bg-info/5 px-5 py-4 text-sm text-ink",
        className,
      )}
    >
      <span className="mr-2 text-base" aria-hidden>💡</span>
      {children}
    </div>
  );
}

// ── BarChart ───────────────────────────────────────────────────────────────

interface BarChartProps {
  data: Datum[];
  height?: number;    // px, default 180
  className?: string;
}

export function BarChart({ data, height = 180, className }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-end gap-2"
        style={{ height }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1.5 hidden rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md group-hover:block">
                <span className="font-semibold text-ink">{d.value}</span>
                {d.note && <span className="ml-1 text-muted">{d.note}</span>}
              </div>
              {/* Bar */}
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${pct}%`,
                  backgroundColor: PALETTE[i % PALETTE.length],
                  minHeight: "2px",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 truncate text-center text-[10px] font-medium text-muted"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DonutChart ─────────────────────────────────────────────────────────────

interface DonutChartProps {
  data: Datum[];
  centerLabel?: string;  // text displayed in the donut hole
  size?: number;         // px diameter, default 180
  className?: string;
}

export function DonutChart({ data, centerLabel, size = 180, className }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;

  // Build slices via stroke-dasharray/offset
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const offset = circumference - cumulative * circumference;
    cumulative += fraction;
    return { ...d, dash, offset, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-start", className)}>
      {/* SVG donut */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Donut chart">
          {/* Background track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
          {slices.map((s) => (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          ))}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold text-ink">{centerLabel}</span>
            <span className="text-xs text-muted">hrs</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <ul className="flex flex-col gap-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="text-ink">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-muted">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── ChartToggle (tabs UI) ──────────────────────────────────────────────────

interface ChartToggleProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ChartToggle({ options, value, onChange, className }: ChartToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-line bg-bg p-1 gap-1",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => (
        <button
          key={opt}
          role="tab"
          aria-selected={opt === value}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            opt === value
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── ToggleChart (controlled chart with tabs) ───────────────────────────────

interface ToggleChartProps {
  options: [string, ...string[]];
  initial?: string;
  render: (active: string) => React.ReactNode;
  className?: string;
}

export function ToggleChart({ options, initial, render, className }: ToggleChartProps) {
  const [active, setActive] = React.useState(initial ?? options[0]);

  return (
    <div className={cn("w-full", className)}>
      <ChartToggle options={options} value={active} onChange={setActive} />
      <div className="mt-4" role="tabpanel">
        {render(active)}
      </div>
    </div>
  );
}
