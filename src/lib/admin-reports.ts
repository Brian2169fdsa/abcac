// ABCAC — admin Reports dashboard data shaping (pure, testable).
//
// The Reports server page fetches raw certification / payment rows plus queue
// counts, and this module turns them into the chart series and insight strings
// the ReportsDashboard client component renders. No Supabase imports here —
// every function is pure compute over plain rows, mirroring
// src/lib/admin-analytics.ts, so the aggregation is unit-testable.

import type { Product } from "@/lib/catalog";
import { formatUsd } from "@/lib/format";

// ── Row + output types ───────────────────────────────────────────────────────

export interface CertRow {
  issued_date: string | null;
  cert_type: string | null;
  status: string | null;
}

export interface PaymentRow {
  created_at: string | null;
  amount_cents: number | null;
  slug: string | null;
  product_name: string | null;
  status: string | null;
}

/** One bar / legend entry (same shape the charts kit consumes). */
export interface ReportsPoint {
  label: string;
  value: number;
  note?: string;
}

export interface ReportsCounts {
  totalMembers: number;
  /** Profiles with an approved account. */
  approvedMembers: number;
  /** Submitted accounts awaiting admin approval. */
  pendingApprovals: number;
  /** CEU submissions awaiting review. */
  pendingCeus: number;
}

export interface ReportsInsights {
  certifications: string;
  certMix: string;
  revenue: string;
  revenueMix: string;
}

export interface ReportsData {
  /** Certs issued per month, last 12 months, oldest → newest, zero-filled. */
  certsByMonth: ReportsPoint[];
  /** Active credentials by cert_type, largest first. */
  certsByType: ReportsPoint[];
  /** Paid revenue (dollars) per month, last 12 months, zero-filled. */
  revenueByMonth: ReportsPoint[];
  /** Paid revenue (dollars) by product category over the window, largest first. */
  revenueByStream: ReportsPoint[];
  /** Certifications currently in "active" status. */
  activeCerts: number;
  counts: ReportsCounts;
  insights: ReportsInsights;
}

// ── Small pure helpers ───────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const monthKey = (iso: string): string => iso.slice(0, 7);
const isPaid = (status: string | null): boolean => status === "paid";

/** Whole-percent share, guarded against zero/empty totals. */
export function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Trailing `n` month buckets (oldest → newest) as {key:"YYYY-MM", label:"Jun"}. */
export function lastMonths(n: number, now: Date = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MONTHS[d.getUTCMonth()],
    });
  }
  return out;
}

/** Zero-filled monthly series: sums `value(row)` into the bucket of `when(row)`. */
export function bucketByMonth<T>(
  rows: T[],
  when: (row: T) => string | null,
  value: (row: T) => number,
  months: { key: string; label: string }[],
): ReportsPoint[] {
  const index = new Map<string, ReportsPoint>();
  const series = months.map((m) => {
    const point: ReportsPoint = { label: m.label, value: 0 };
    index.set(m.key, point);
    return point;
  });
  for (const row of rows) {
    const iso = when(row);
    if (!iso) continue;
    const point = index.get(monthKey(iso));
    if (point) point.value += value(row);
  }
  return series;
}

/** Active credentials grouped by cert_type, largest first. */
export function certsByType(certs: CertRow[]): ReportsPoint[] {
  const counts = new Map<string, number>();
  for (const c of certs) {
    if (c.status !== "active") continue;
    const type = c.cert_type || "Other";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Paid revenue (dollars) grouped into streams by the catalog category of each
 * payment's slug. Slugs missing from the catalog fall into "Other".
 */
export function revenueByStream(payments: PaymentRow[], products: Product[]): ReportsPoint[] {
  const categoryBySlug = new Map(products.map((p) => [p.slug, p.category]));
  const totals = new Map<string, number>();
  for (const p of payments) {
    if (!isPaid(p.status)) continue;
    const category = (p.slug && categoryBySlug.get(p.slug)) || "Other";
    totals.set(category, (totals.get(category) ?? 0) + num(p.amount_cents) / 100);
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

/** The largest entry in a series (or a zero placeholder for empty data). */
export function peakOf(rows: ReportsPoint[]): ReportsPoint {
  return rows.reduce((a, b) => (b.value > a.value ? b : a), { label: "—", value: 0 });
}

// ── Insights (real-number takeaway lines) ────────────────────────────────────

export function buildInsights(args: {
  certsByMonth: ReportsPoint[];
  certsByType: ReportsPoint[];
  revenueByMonth: ReportsPoint[];
  revenueByStream: ReportsPoint[];
  activeCerts: number;
  counts: ReportsCounts;
}): ReportsInsights {
  const { certsByMonth, certsByType: mix, revenueByMonth, revenueByStream: streams, activeCerts, counts } = args;

  const certTotal = certsByMonth.reduce((s, p) => s + p.value, 0);
  const certPeak = peakOf(certsByMonth);
  const certifications =
    certTotal > 0
      ? `${certTotal.toLocaleString("en-US")} certification${certTotal === 1 ? "" : "s"} issued over the last 12 months, peaking at ${certPeak.value} in ${certPeak.label}. ${counts.pendingApprovals.toLocaleString("en-US")} account${counts.pendingApprovals === 1 ? "" : "s"} awaiting approval and ${counts.pendingCeus.toLocaleString("en-US")} CEU submission${counts.pendingCeus === 1 ? "" : "s"} pending review.`
      : "No certifications issued in the last 12 months yet — issuance will chart here as credentials go live.";

  const topTwo = mix.slice(0, 2);
  const topTwoShare = pctOf(
    topTwo.reduce((s, t) => s + t.value, 0),
    mix.reduce((s, t) => s + t.value, 0),
  );
  const certMix =
    mix.length > 0
      ? `${topTwo.map((t) => t.label).join(" and ")} account${topTwo.length === 1 ? "s" : ""} for ${topTwoShare}% of the ${activeCerts.toLocaleString("en-US")} active credentials, spread across ${mix.length} credential type${mix.length === 1 ? "" : "s"}.`
      : "No active credentials on record yet — the mix will populate as certifications are issued.";

  const thisMonth = revenueByMonth[revenueByMonth.length - 1]?.value ?? 0;
  const lastMonth = revenueByMonth[revenueByMonth.length - 2]?.value ?? 0;
  const revTotal = revenueByMonth.reduce((s, p) => s + p.value, 0);
  const momPhrase =
    lastMonth > 0
      ? `${thisMonth >= lastMonth ? "up" : "down"} ${Math.abs(pctOf(thisMonth - lastMonth, lastMonth))}% vs ${formatUsd(lastMonth)} last month`
      : "with no revenue recorded last month";
  const revenue =
    revTotal > 0
      ? `Revenue this month is ${formatUsd(thisMonth)}, ${momPhrase}. Paid payments total ${formatUsd(revTotal)} over the trailing 12 months.`
      : "No paid payments recorded in the last 12 months — revenue will chart here as transactions land.";

  const topStream = streams[0];
  const streamTotal = streams.reduce((s, p) => s + p.value, 0);
  const revenueMix = topStream
    ? `${topStream.label} leads revenue at ${pctOf(topStream.value, streamTotal)}% of the last 12 months (${formatUsd(topStream.value)} of ${formatUsd(streamTotal)}) across ${streams.length} stream${streams.length === 1 ? "" : "s"}.`
    : "No paid payments to break into streams yet — categories appear as products sell.";

  return { certifications, certMix, revenue, revenueMix };
}

// ── Assembler ────────────────────────────────────────────────────────────────

/** Shape raw rows + counts into everything the Reports dashboard renders. */
export function buildReportsData(args: {
  certs: CertRow[];
  payments: PaymentRow[];
  products: Product[];
  counts: ReportsCounts;
  now?: Date;
}): ReportsData {
  const months = lastMonths(12, args.now ?? new Date());
  const paid = args.payments.filter((p) => isPaid(p.status));

  const certsByMonth = bucketByMonth(args.certs, (c) => c.issued_date, () => 1, months);
  const revenueByMonthSeries = bucketByMonth(
    paid,
    (p) => p.created_at,
    (p) => num(p.amount_cents) / 100,
    months,
  ).map((p) => ({ ...p, value: Math.round(p.value) }));
  const mix = certsByType(args.certs);
  const streams = revenueByStream(args.payments, args.products);
  const activeCerts = args.certs.filter((c) => c.status === "active").length;

  return {
    certsByMonth,
    certsByType: mix,
    revenueByMonth: revenueByMonthSeries,
    revenueByStream: streams,
    activeCerts,
    counts: args.counts,
    insights: buildInsights({
      certsByMonth,
      certsByType: mix,
      revenueByMonth: revenueByMonthSeries,
      revenueByStream: streams,
      activeCerts,
      counts: args.counts,
    }),
  };
}
