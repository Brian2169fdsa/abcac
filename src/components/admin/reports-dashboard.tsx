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
// Data source: the demo mock dataset (src/lib/mock/agent-data.ts) — rich enough
// to tell the full story for the Saturday walk-through. Swaps to live queries at
// cut-over without touching this presentation layer.

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
import {
  CERTS_BY_MONTH,
  CERTS_BY_TYPE,
  REVENUE_BY_MONTH,
  REVENUE_BY_STREAM,
  INSIGHTS,
  type Datum,
} from "@/lib/mock/agent-data";

const int = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => "$" + n.toLocaleString("en-US");

const sum = (rows: { value: number }[]) => rows.reduce((s, r) => s + r.value, 0);
const peak = (rows: { label: string; value: number }[]) =>
  rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0]);

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

function topHighlights(rows: Datum[], format: (n: number) => string): HighlightCard[] {
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

function buildLenses(): Lens[] {
  const certPeak = peak(CERTS_BY_MONTH);
  const certYtd = sum(CERTS_BY_MONTH);
  const revPeak = peak(REVENUE_BY_MONTH);
  const revYtd = sum(REVENUE_BY_MONTH);
  const typeTotal = sum(CERTS_BY_TYPE);
  const streamTotal = sum(REVENUE_BY_STREAM);
  const renewals = REVENUE_BY_STREAM.find((s) => s.label === "Renewals")?.value ?? 0;

  return [
    {
      key: "Certifications",
      kpis: [
        { label: "Certs issued (12 mo)", value: int(certYtd), sub: "Across 6 credential types", delta: "+12% vs last yr", trend: "up" },
        { label: "Best month", value: int(certPeak.value), sub: `${certPeak.label} — peak issuance`, trend: "up" },
        { label: "Avg / month", value: Math.round(certYtd / CERTS_BY_MONTH.length).toString(), sub: "Trailing 12 months", trend: "flat" },
        { label: "Active members", value: "1,247", sub: "892 in good standing", delta: "+38 this month", trend: "up" },
      ],
      data: CERTS_BY_MONTH,
      format: int,
      insight:
        `Issuance is trending up — the spring window (Mar–May) is the strongest stretch of the year, peaking at ${certPeak.value} in ${certPeak.label}. The Q2 renewal cycle pulls new associates onto the ladder.`,
      highlightsTitle: "Top credential types",
      highlights: topHighlights(CERTS_BY_TYPE, (n) => `${int(n)} issued`),
    },
    {
      key: "Credential mix",
      kpis: [
        { label: "Total credentials", value: int(typeTotal), sub: "Issued across all types", trend: "flat" },
        { label: "Largest segment", value: "LISAC", sub: `${Math.round((CERTS_BY_TYPE[0].value / typeTotal) * 100)}% of all issued`, trend: "up" },
        { label: "Credential types", value: String(CERTS_BY_TYPE.length), sub: "Independent → technician", trend: "flat" },
        { label: "Reciprocity", value: int(CERTS_BY_TYPE.find((t) => t.label === "Reciprocity")?.value ?? 0), sub: "Out-of-state transfers", delta: "fastest-growing YoY", trend: "up" },
      ],
      data: CERTS_BY_TYPE,
      format: int,
      insight: INSIGHTS.certMix,
      highlightsTitle: "Top credential types",
      highlights: topHighlights(CERTS_BY_TYPE, (n) => `${int(n)} issued`),
    },
    {
      key: "Revenue trend",
      kpis: [
        { label: "Revenue (12 mo)", value: formatMoneyCompact(revYtd), sub: "Certs · renewals · CEUs", delta: "+9% YoY", trend: "up" },
        { label: "Best month", value: formatMoneyCompact(revPeak.value), sub: `${revPeak.label} — peak revenue`, trend: "up" },
        { label: "Avg / month", value: formatMoneyCompact(Math.round(revYtd / REVENUE_BY_MONTH.length)), sub: "Trailing 12 months", trend: "flat" },
        { label: "Recurring base", value: `${Math.round((renewals / streamTotal) * 100)}%`, sub: "From renewals (MTD)", trend: "up" },
      ],
      data: REVENUE_BY_MONTH,
      format: formatMoneyCompact,
      insight: INSIGHTS.revenue,
      highlightsTitle: "Top revenue streams (MTD)",
      highlights: topHighlights(REVENUE_BY_STREAM, usd),
    },
    {
      key: "Revenue mix",
      kpis: [
        { label: "Revenue (MTD)", value: formatMoneyCompact(streamTotal), sub: "Across 6 streams", delta: "+9% MoM", trend: "up" },
        { label: "Top stream", value: "New certs", sub: `${Math.round((REVENUE_BY_STREAM[0].value / streamTotal) * 100)}% of monthly revenue`, trend: "up" },
        { label: "Renewals", value: formatMoneyCompact(renewals), sub: `${Math.round((renewals / streamTotal) * 100)}% recurring base`, trend: "up" },
        { label: "CEU fees", value: formatMoneyCompact(REVENUE_BY_STREAM.find((s) => s.label === "CEU fees")?.value ?? 0), sub: "Logged through the portal", delta: "+18% MoM", trend: "up" },
      ],
      data: REVENUE_BY_STREAM,
      format: formatMoneyCompact,
      insight: INSIGHTS.revenue,
      highlightsTitle: "Top revenue streams (MTD)",
      highlights: topHighlights(REVENUE_BY_STREAM, usd),
    },
  ];
}

const LENSES = buildLenses();

export function ReportsDashboard() {
  const [lensKey, setLensKey] = useState(LENSES[0].key);
  const lens = LENSES.find((l) => l.key === lensKey) ?? LENSES[0];

  return (
    <div className="space-y-6">
      {/* KPI row — reframes per lens */}
      <StatCardRow>
        {lens.kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </StatCardRow>

      {/* Lens toggle */}
      <ChartToggle options={LENSES.map((l) => l.key)} value={lensKey} onChange={setLensKey} />

      {/* Chart */}
      <div className="rounded-xl border border-line bg-surface p-5">
        <BarChart data={lens.data} format={lens.format} showLegend={false} height={300} />
      </div>

      {/* Big takeaway */}
      <InsightCallout>{lens.insight}</InsightCallout>

      {/* Highlight cards */}
      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">{lens.highlightsTitle}</h2>
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
      </div>
    </div>
  );
}
