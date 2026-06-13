// ABCAC — Automation Analytics: pure window/lens helpers (server-safe).
//
// These live OUTSIDE the "use client" analytics-dashboard island so the server
// analytics page can call them during render. Importing a plain function from a
// "use client" module yields a client-reference proxy that throws
// "is not a function" when invoked on the server (and breaks RSC prop
// serialization). The interactive chart island re-exports these for tests and
// for its own use.

import type { BarDatum } from "@/components/agent/charts";
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
