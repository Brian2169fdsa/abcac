"use client";

// ABCAC — Automation Analytics: interactive "runs over time" chart.
//
// The server component computes the daily series and hands it down as plain
// data; this client island owns only the lens toggle (Total / Automated /
// Escalated / Failed) and renders the shared BarChart primitive. The pure
// mappers below are exported so they can be unit-tested without a DOM render.

import { useState } from "react";
import { BarChart, ChartToggle, formatCompact, type BarDatum } from "@/components/agent/charts";

// ── Types (mirrors the server-computed shapes) ──────────────────────────────

/** One calendar day of automation-run counts. */
export interface DailyPoint {
  /** ISO date, e.g. "2026-06-04". */
  date: string;
  total: number;
  automated: number;
  escalated: number;
  failed: number;
}

// ── Window selection (shared with the page; pure, lives here because a
//    Next.js page file may only export a default + reserved fields) ───────────

export const ALLOWED_DAYS = [7, 30, 90] as const;
export type AllowedDays = (typeof ALLOWED_DAYS)[number];
export const DEFAULT_DAYS: AllowedDays = 30;

/** Clamp an arbitrary `?days=` value to the allowed set; default 30. */
export function clampDays(value: string | string[] | number | null | undefined): AllowedDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  return (ALLOWED_DAYS as readonly number[]).includes(n) ? (n as AllowedDays) : DEFAULT_DAYS;
}

// ── Catalog (labels + categories for the known workflows) ────────────────────

export type WorkflowCategory = "Compliance" | "Billing" | "Documents" | "Other";

interface WorkflowMeta {
  label: string;
  category: WorkflowCategory;
}

const WORKFLOW_META: Record<string, WorkflowMeta> = {
  credential_verification: { label: "Credential verification", category: "Compliance" },
  ceu_review: { label: "CEU review", category: "Compliance" },
  dunning: { label: "Dunning", category: "Billing" },
  invoice_generation: { label: "Invoice generation", category: "Billing" },
  doc_request: { label: "Document request", category: "Documents" },
};

function titleCase(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human label for a workflow key; falls back to a title-cased slug. */
export function workflowLabel(workflow: string): string {
  return WORKFLOW_META[workflow]?.label ?? titleCase(workflow);
}

/** Category for a workflow key; "Other" when unknown. */
export function workflowCategory(workflow: string): WorkflowCategory {
  return WORKFLOW_META[workflow]?.category ?? "Other";
}

const ANOMALY_LABEL: Record<string, string> = {
  member_mismatch: "Member mismatch",
  entity_mismatch: "Entity mismatch",
  future_dated: "Future-dated",
  duplicate_hash: "Duplicate",
  state_moved: "State moved",
};

/** Friendly label for an anomaly/escalation reason flag. */
export function anomalyLabel(reason: string): string {
  return ANOMALY_LABEL[reason] ?? titleCase(reason);
}

// ── Formatting (mirrors src/lib/format conventions) ──────────────────────────

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatPercent(ratio: number): string {
  const pct = (Number.isFinite(ratio) ? ratio : 0) * 100;
  return `${pct.toFixed(pct < 10 && pct > 0 ? 1 : 0)}%`;
}

/** Minutes → "2h 30m" / "45m" / "0m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** The four chart lenses, in display order. */
export const LENSES = ["Total", "Automated", "Escalated", "Failed"] as const;
export type Lens = (typeof LENSES)[number];

// ── Pure helpers (exported for unit tests) ──────────────────────────────────

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
 * Format an ISO date ("2026-06-04") as a short axis label ("Jun 4").
 * Parsed as UTC so the label never drifts by a day across timezones.
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

// ── Component ───────────────────────────────────────────────────────────────

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
