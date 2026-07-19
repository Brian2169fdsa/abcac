"use client";

// ABCAC — Admin Reports dashboard (screenshot-styled analytics).
//
// Mirrors the reference layout: a KPI stat-card row, a pill TOGGLE that swaps the
// reporting "lens", a bar chart that re-maps to the selected lens, the agent's
// "big takeaway" insight callout, and a row of highlight cards. Each lens carries
// its own KPIs / chart / formatter / insight / highlights, so switching the
// toggle reframes the whole view the way an admin would actually pivot:
// certifications issued, the credential mix, revenue over time, and revenue mix.
//
// Data source: live Supabase aggregates passed down from the server page
// (src/app/(admin)/admin/reports/page.tsx → src/lib/admin-reports.ts). This
// component is presentation only — it never fetches.

import { useState } from "react";
import {
  StatCard,
  StatCardRow,
  ChartToggle,
  BarChart,
  InsightCallout,
  formatMoneyCompact,
  type StatCardProps,
  type BarDatum,
} from "@/components/agent/charts";
import { peakOf, pctOf, type ReportsData, type ReportsPoint } from "@/lib/admin-reports";

const int = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const sum = (rows: { value: number }[]) => rows.reduce((s, r) => s + r.value, 0);

/** "up"/"down"/"flat" from the last two points of a monthly series. */
const trendOf = (rows: ReportsPoint[]): "up" | "down" | "flat" => {
  const last = rows[rows.length - 1]?.value ?? 0;
  const prev = rows[rows.length - 2]?.value ?? 0;
  return last > prev ? "up" : last < prev ? "down" : "flat";
};

interface HighlightCard {
  rank: number;
  title: string;
  sub: string;
  metric: string;
  share: number; // 0..100
}

interface Lens {
  key: string;
  kpis: StatCardProps[];
  data: BarDatum[];
  format: (n: number) => string;
  insight: string;
  highlightsTitle: string;
  highlights: HighlightCard[];
}

function topHighlights(rows: ReportsPoint[], format: (n: number) => string): HighlightCard[] {
  const total = sum(rows) || 1;
  return [...rows]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((d, i) => ({
      rank: i + 1,
      title: d.label,
      sub: d.note ?? "",
      metric: format(d.value),
      share: Math.round((d.value / total) * 100),
    }));
}

function buildLenses(data: ReportsData): Lens[] {
  const { certsByMonth, certsByType, revenueByMonth, revenueByStream, activeCerts, counts, insights } = data;

  const certPeak = peakOf(certsByMonth);
  const certYtd = sum(certsByMonth);
  const revPeak = peakOf(revenueByMonth);
  const revYtd = sum(revenueByMonth);
  const typeTotal = sum(certsByType);
  const streamTotal = sum(revenueByStream);
  const topType = certsByType[0];
  const topStream = revenueByStream[0];

  const revThisMonth = revenueByMonth[revenueByMonth.length - 1]?.value ?? 0;
  const revLastMonth = revenueByMonth[revenueByMonth.length - 2]?.value ?? 0;
  const revDelta =
    revLastMonth > 0
      ? `${revThisMonth >= revLastMonth ? "+" : "-"}${Math.abs(pctOf(revThisMonth - revLastMonth, revLastMonth))}% vs last month`
      : undefined;

  return [
    {
      key: "Certifications",
      kpis: [
        { label: "Certs issued (12 mo)", value: int(certYtd), sub: `Across ${certsByType.length} credential type${certsByType.length === 1 ? "" : "s"}`, trend: trendOf(certsByMonth) },
        { label: "Best month", value: int(certPeak.value), sub: `${certPeak.label} — peak issuance`, trend: "up" },
        { label: "Avg / month", value: int(Math.round(certYtd / (certsByMonth.length || 1))), sub: "Trailing 12 months", trend: "flat" },
        { label: "Active members", value: int(counts.approvedMembers), sub: `${int(counts.totalMembers)} total profiles`, delta: counts.pendingApprovals > 0 ? `${int(counts.pendingApprovals)} awaiting approval` : undefined, trend: "flat" },
      ],
      data: certsByMonth,
      format: int,
      insight: insights.certifications,
      highlightsTitle: "Top credential types",
      highlights: topHighlights(certsByType, (n) => `${int(n)} active`),
    },
    {
      key: "Credential mix",
      kpis: [
        { label: "Active credentials", value: int(activeCerts), sub: "Currently in active status", trend: "flat" },
        { label: "Largest segment", value: topType?.label ?? "—", sub: `${pctOf(topType?.value ?? 0, typeTotal)}% of active credentials`, trend: "up" },
        { label: "Credential types", value: String(certsByType.length), sub: "With active holders", trend: "flat" },
        { label: "CEU reviews pending", value: int(counts.pendingCeus), sub: "Awaiting admin review", trend: "flat" },
      ],
      data: certsByType,
      format: int,
      insight: insights.certMix,
      highlightsTitle: "Top credential types",
      highlights: topHighlights(certsByType, (n) => `${int(n)} active`),
    },
    {
      key: "Revenue trend",
      kpis: [
        { label: "Revenue (12 mo)", value: formatMoneyCompact(revYtd), sub: "Paid payments", trend: trendOf(revenueByMonth) },
        { label: "Best month", value: formatMoneyCompact(revPeak.value), sub: `${revPeak.label} — peak revenue`, trend: "up" },
        { label: "Avg / month", value: formatMoneyCompact(Math.round(revYtd / (revenueByMonth.length || 1))), sub: "Trailing 12 months", trend: "flat" },
        { label: "This month", value: formatMoneyCompact(revThisMonth), sub: "Month to date", delta: revDelta, trend: trendOf(revenueByMonth) },
      ],
      data: revenueByMonth,
      format: formatMoneyCompact,
      insight: insights.revenue,
      highlightsTitle: "Top revenue streams (12 mo)",
      highlights: topHighlights(revenueByStream, usd),
    },
    {
      key: "Revenue mix",
      kpis: [
        { label: "Revenue (12 mo)", value: formatMoneyCompact(streamTotal), sub: `Across ${revenueByStream.length} stream${revenueByStream.length === 1 ? "" : "s"}`, trend: trendOf(revenueByMonth) },
        { label: "Top stream", value: topStream?.label ?? "—", sub: `${pctOf(topStream?.value ?? 0, streamTotal)}% of 12-month revenue`, trend: "up" },
        { label: "Top stream revenue", value: formatMoneyCompact(topStream?.value ?? 0), sub: topStream?.label ?? "No paid payments yet", trend: "flat" },
        { label: "Other streams", value: formatMoneyCompact(streamTotal - (topStream?.value ?? 0)), sub: "Everything outside the top stream", trend: "flat" },
      ],
      data: revenueByStream,
      format: formatMoneyCompact,
      insight: insights.revenueMix,
      highlightsTitle: "Top revenue streams (12 mo)",
      highlights: topHighlights(revenueByStream, usd),
    },
  ];
}

export interface ReportsDashboardProps {
  data: ReportsData;
}

export function ReportsDashboard({ data }: ReportsDashboardProps) {
  const lenses = buildLenses(data);
  const [lensKey, setLensKey] = useState(lenses[0].key);
  const lens = lenses.find((l) => l.key === lensKey) ?? lenses[0];

  return (
    <div className="space-y-6">
      {/* KPI row — reframes per lens */}
      <StatCardRow>
        {lens.kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </StatCardRow>

      {/* Lens toggle */}
      <ChartToggle options={lenses.map((l) => l.key)} value={lensKey} onChange={setLensKey} />

      {/* Chart */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <BarChart data={lens.data} format={lens.format} showLegend={false} height={300} />
      </div>

      {/* Big takeaway */}
      <InsightCallout>{lens.insight}</InsightCallout>

      {/* Highlight cards */}
      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">{lens.highlightsTitle}</h2>
        {lens.highlights.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
            No data recorded yet — highlights appear as activity lands.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {lens.highlights.map((c) => (
              <div key={c.title} className="rounded-xl border border-line bg-surface p-5">
                <span className="inline-flex items-center rounded-md bg-ink/[0.06] px-2 py-0.5 text-[12px] font-semibold text-ink/70">
                  #{c.rank}
                </span>
                <div className="mt-3 font-display text-lg font-bold text-ink">{c.title}</div>
                {c.sub && <div className="mt-0.5 text-[13px] text-muted">{c.sub}</div>}
                <div className="mt-3 font-display text-2xl font-bold text-brand">{c.metric}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${c.share}%` }} aria-hidden />
                </div>
                <div className="mt-1 text-[12px] text-muted">{c.share}% of total</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
