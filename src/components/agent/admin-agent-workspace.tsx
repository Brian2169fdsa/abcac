"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/assistant/markdown";
import {
  StatCard,
  StatCardRow,
  ToggleChart,
  BarChart,
  DonutChart,
  InsightCallout,
  StatusPill,
  formatMoneyCompact,
} from "@/components/agent/charts";
import {
  MOCK_MEMBERS,
  MOCK_TASKS,
  type MockMember,
} from "@/lib/mock/agent-data";
import type { AdminAnalytics, TrendPoint } from "@/lib/admin-analytics";
import { formatUsd } from "@/lib/format";
import { TaskRail } from "@/components/agent/task-rail";

// ── Real-data series helpers (TrendPoint[] → chart BarDatum[]) ────────────────

const revenueSeries = (t: TrendPoint[]) => t.map((p) => ({ label: p.label, value: p.revenueCents / 100 }));
const certsSeries = (t: TrendPoint[]) => t.map((p) => ({ label: p.label, value: p.certsIssued }));
const membersSeries = (t: TrendPoint[]) => t.map((p) => ({ label: p.label, value: p.newMembers }));
const ceusSeries = (t: TrendPoint[]) => t.map((p) => ({ label: p.label, value: p.ceusLogged }));

/** Month-over-month delta label from the last two points of a real series. */
function momDelta(series: { value: number }[]): { delta?: string; trend: "up" | "down" | "flat" } {
  if (series.length < 2) return { trend: "flat" };
  const cur = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  if (prev === 0) return { trend: cur > 0 ? "up" : "flat", delta: cur > 0 ? "new" : undefined };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { delta: `${pct >= 0 ? "+" : ""}${pct}% MoM`, trend: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

// ── Artifact helpers ─────────────────────────────────────────────────────────

function ArtifactCertSales(a: AdminAnalytics): ReactNode {
  const byType = a.certsByType.map((s) => ({ label: s.certType, value: s.count }));
  const certsByMonth = certsSeries(a.trends);
  const topCerts = byType.slice(0, 3);
  const activeTotal = byType.reduce((s, d) => s + d.value, 0);
  const avgPerMonth = certsByMonth.length
    ? Math.round(certsByMonth.reduce((s, d) => s + d.value, 0) / certsByMonth.length)
    : 0;
  const certDelta = momDelta(certsByMonth);

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-5">
      {/* Mini KPIs */}
      <StatCardRow>
        <StatCard label="Certs issued (YTD)" value={String(a.kpis.certsYtd)} sub="This calendar year" />
        <StatCard
          label="Top credential"
          value={topCerts[0]?.label ?? "—"}
          sub={topCerts[0] ? `${topCerts[0].value} active` : "No active certs"}
          trend="up"
        />
        <StatCard label="Active credentials" value={String(activeTotal)} sub={`${byType.length} credential types`} />
        <StatCard
          label="Issued / month"
          value={String(avgPerMonth)}
          sub="Trailing 12 months"
          delta={certDelta.delta}
          trend={certDelta.trend}
        />
      </StatCardRow>

      {/* Type mix toggle */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Active credential mix
        </div>
        {byType.length ? (
          <ToggleChart
            options={["Bar chart", "Donut"]}
            render={(selected) =>
              selected === "Bar chart" ? (
                <BarChart data={byType} height={220} />
              ) : (
                <DonutChart data={byType} centerLabel={String(activeTotal)} centerSub="total" />
              )
            }
          />
        ) : (
          <EmptyChart label="No active certifications yet." />
        )}
      </div>

      {/* Monthly trend */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Issued per month (12 mo)
        </div>
        <BarChart data={certsByMonth} height={180} showLegend={false} rotateLabels />
      </div>

      <InsightCallout>
        {topCerts[0]
          ? `${activeTotal} active credentials across ${byType.length} types — ${topCerts[0].label} leads with ${topCerts[0].value}. ${a.kpis.certsYtd} issued so far this year (${avgPerMonth}/month on average).`
          : "No active certifications recorded yet."}
      </InsightCallout>
    </div>
  );
}

function ArtifactRevenue(a: AdminAnalytics): ReactNode {
  const revByMonth = revenueSeries(a.trends);
  const revDelta = momDelta(revByMonth);
  const peak = revByMonth.reduce((m, d) => (d.value > m.value ? d : m), { label: "—", value: 0 });

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-5">
      {/* Money KPIs (real) */}
      <StatCardRow>
        <StatCard
          label="Revenue (MTD)"
          value={formatUsd(a.kpis.revenueMtdCents / 100)}
          sub="Month to date"
          delta={revDelta.delta}
          trend={revDelta.trend}
        />
        <StatCard label="Revenue (YTD)" value={formatUsd(a.kpis.revenueYtdCents / 100)} sub="This calendar year" trend="up" />
        <StatCard label="Best month" value={formatMoneyCompact(peak.value)} sub={`${peak.label} — peak`} trend="up" />
        <StatCard
          label="Avg / month"
          value={formatMoneyCompact(
            revByMonth.length ? Math.round(revByMonth.reduce((s, d) => s + d.value, 0) / revByMonth.length) : 0,
          )}
          sub="Trailing 12 months"
        />
      </StatCardRow>

      {/* Monthly trend */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Revenue trend (12 mo)
        </div>
        <BarChart data={revByMonth} height={200} format={formatMoneyCompact} showLegend={false} rotateLabels />
      </div>

      <InsightCallout>
        {`Revenue this month is ${formatUsd(a.kpis.revenueMtdCents / 100)} (${revDelta.delta ?? "no prior month"}); ${formatUsd(
          a.kpis.revenueYtdCents / 100,
        )} year to date, peaking in ${peak.label}.`}
      </InsightCallout>
    </div>
  );
}

function ArtifactMembers(): ReactNode {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink text-white">
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">Credential</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">City</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">CEU</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">Renewal</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MOCK_MEMBERS.map((m: MockMember) => (
              <tr key={m.id} className="even:bg-bg/60 hover:bg-bg transition-colors">
                <td className="px-4 py-2.5 font-medium text-ink">{m.name}</td>
                <td className="px-4 py-2.5 text-ink/80">{m.credential}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={m.status} />
                </td>
                <td className="px-4 py-2.5 text-ink/80">{m.city}</td>
                <td className="px-4 py-2.5 text-ink/80">
                  {m.ceuDone}/{m.ceuRequired}
                </td>
                <td className="px-4 py-2.5 text-ink/80">{m.renewal}</td>
                <td className="px-4 py-2.5 font-medium text-ink">
                  {formatMoneyCompact(m.spend)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The real open-work queues, with the route an admin clears each from. */
function attentionRows(a: AdminAnalytics) {
  const n = a.needsAttention;
  return [
    { label: "Pending account approvals", value: n.pendingApprovals, href: "/admin/approvals" },
    { label: "CEU certificates to review", value: n.pendingCeus, href: "/admin/ceus" },
    { label: "Applications in review", value: n.pendingApplications, href: "/admin/applications" },
    { label: "Open document requests", value: n.openDocRequests, href: "/admin/documents" },
    { label: "Member requests (name / verify / reciprocity)", value: n.openRequests, href: "/admin/requests" },
    { label: "Automation escalations", value: n.escalations, href: "/admin/automation" },
    { label: "Credentials expiring ≤60 days", value: n.expiringSoon, href: "/admin/renewals" },
  ];
}

function ArtifactAttention(a: AdminAnalytics): ReactNode {
  const rows = attentionRows(a).filter((r) => r.value > 0);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        Open work — {a.needsAttention.total} item{a.needsAttention.total === 1 ? "" : "s"}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <a
              key={r.label}
              href={r.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2.5 transition-colors hover:border-brand"
            >
              <span className="text-[13px] text-ink">{r.label}</span>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-semibold text-brand">{r.value}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-bg/40 px-4 py-8 text-center text-[13px] text-muted">
          Nothing needs attention right now — every queue is clear. 🎉
        </p>
      )}
      <InsightCallout>
        {a.needsAttention.total === 0
          ? "All staff queues are clear."
          : `${a.needsAttention.total} open items across ${rows.length} ${rows.length === 1 ? "queue" : "queues"}. ${
              a.needsAttention.pendingCeus > 0 ? `${a.needsAttention.pendingCeus} CEUs await review; ` : ""
            }${a.needsAttention.expiringSoon} credentials lapse within 60 days.`}
      </InsightCallout>
    </div>
  );
}

function ArtifactAutomate(): ReactNode {
  const automatableTasks = MOCK_TASKS.filter((t) => t.automatable);

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        Automatable now — {automatableTasks.length} tasks
      </div>
      <div className="space-y-3">
        {automatableTasks.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-lg border border-[#1F5FA8]/20 bg-[#1F5FA8]/[0.03] p-3">
            <span className="mt-0.5 text-[#1F5FA8]" aria-hidden>⚡</span>
            <div>
              <p className="text-[13px] font-semibold text-ink">{t.title}</p>
              <p className="mt-0.5 text-[12px] text-muted">{t.detail}</p>
              <p className="mt-1 text-[11px] text-muted">{t.due} · {t.member}</p>
            </div>
          </div>
        ))}
      </div>
      <InsightCallout>
        These are illustrative automation candidates. Turning on the matching workflows in
        Automation clears them from the manual queue.
      </InsightCallout>
    </div>
  );
}

/** Small placeholder shown when a chart has no data. */
function EmptyChart({ label }: { label: string }): ReactNode {
  return (
    <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-10 text-center text-[13px] text-muted">
      {label}
    </div>
  );
}

// ── Artifact registry ────────────────────────────────────────────────────────

type ArtifactKey =
  | "cert-sales"
  | "revenue"
  | "members"
  | "attention"
  | "automate";

const ARTIFACT_REGISTRY: Record<ArtifactKey, { label: string; render: (a: AdminAnalytics) => ReactNode }> = {
  "cert-sales": {
    label: "Certification sales overview",
    render: (a) => <>{ArtifactCertSales(a)}</>,
  },
  revenue: {
    label: "Revenue this month",
    render: (a) => <>{ArtifactRevenue(a)}</>,
  },
  members: {
    label: "Member directory",
    render: () => <ArtifactMembers />,
  },
  attention: {
    label: "Items needing attention",
    render: (a) => <>{ArtifactAttention(a)}</>,
  },
  automate: {
    label: "Automatable tasks",
    render: () => <ArtifactAutomate />,
  },
};

// ── Trends panel (real data, toggled by the top-right button) ─────────────────

function TrendsPanel({ analytics }: { analytics: AdminAnalytics }): ReactNode {
  const a = analytics;
  const byType = a.certsByType.map((s) => ({ label: s.certType, value: s.count }));
  const attention = attentionRows(a);
  const generated = new Date(a.generatedAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <section className="space-y-5 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink">Trends</h2>
          <p className="text-[13px] text-muted">Live data across the last 12 months · as of {generated}</p>
        </div>
      </div>

      {/* KPI row (real) */}
      <StatCardRow>
        <StatCard label="Certs issued (YTD)" value={String(a.kpis.certsYtd)} sub={`${a.kpis.certTypeCount} credential types`} />
        <StatCard label="Members" value={String(a.kpis.totalMembers)} sub={`${a.kpis.goodStanding} in good standing`} />
        <StatCard label="Revenue (YTD)" value={formatUsd(a.kpis.revenueYtdCents / 100)} sub={`${formatUsd(a.kpis.revenueMtdCents / 100)} MTD`} trend="up" />
        <StatCard label="Open work items" value={String(a.kpis.openItems)} sub="Across all staff queues" />
      </StatCardRow>

      <div className="grid gap-5 lg:grid-cols-2">
        <TrendBlock title="Revenue per month">
          <BarChart data={revenueSeries(a.trends)} height={200} format={formatMoneyCompact} showLegend={false} rotateLabels />
        </TrendBlock>
        <TrendBlock title="Certifications issued per month">
          <BarChart data={certsSeries(a.trends)} height={200} showLegend={false} rotateLabels />
        </TrendBlock>
        <TrendBlock title="New members per month">
          <BarChart data={membersSeries(a.trends)} height={200} showLegend={false} rotateLabels />
        </TrendBlock>
        <TrendBlock title="CEU hours logged per month">
          <BarChart data={ceusSeries(a.trends)} height={200} showLegend={false} rotateLabels />
        </TrendBlock>
        <TrendBlock title="Active credential mix">
          {byType.length ? (
            <DonutChart data={byType} centerLabel={String(byType.reduce((s, d) => s + d.value, 0))} centerSub="active" />
          ) : (
            <EmptyChart label="No active certifications yet." />
          )}
        </TrendBlock>
        <TrendBlock title="What needs attention">
          <div className="space-y-2">
            {attention.map((r) => (
              <a key={r.label} href={r.href} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-3 py-2 transition-colors hover:border-brand">
                <span className="text-[13px] text-ink">{r.label}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", r.value > 0 ? "bg-brand/10 text-brand" : "bg-muted/10 text-muted")}>{r.value}</span>
              </a>
            ))}
          </div>
        </TrendBlock>
      </div>
    </section>
  );
}

function TrendBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  );
}

// ── Scripted suggestions ─────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  prompt: string;
  artifactKey: ArtifactKey;
  assistantIntro: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Certification sales",
    prompt: "Show me certification sales",
    artifactKey: "cert-sales",
    assistantIntro:
      "Here's an overview of certification sales across all credential types for the past 12 months.",
  },
  {
    label: "Revenue this month",
    prompt: "How's revenue this month?",
    artifactKey: "revenue",
    assistantIntro:
      "Revenue is tracking well this month. Here's a breakdown by stream and the 12-month trend.",
  },
  {
    label: "Member directory",
    prompt: "Who are my members?",
    artifactKey: "members",
    assistantIntro:
      "Here's your current member roster with credential, status, CEU progress, renewal dates, and lifetime spend.",
  },
  {
    label: "What needs attention?",
    prompt: "What needs my attention?",
    artifactKey: "attention",
    assistantIntro:
      "Here are the high-priority items that need action today or within the next few days.",
  },
  {
    label: "What can you automate?",
    prompt: "What can you automate right now?",
    artifactKey: "automate",
    assistantIntro:
      "These tasks are fully automatable today — clean data, verified credentials, ready to go.",
  },
];

// ── Message types ────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface TextMessage {
  role: Role;
  text: string;
  artifact?: undefined;
}

interface ArtifactMessage {
  role: "assistant";
  text: string;
  artifact: ArtifactKey;
}

type ChatMessage = TextMessage | ArtifactMessage;

// ── Greeting ─────────────────────────────────────────────────────────────────

const GREETING: ChatMessage = {
  role: "assistant",
  text: "Hi! I'm your Admin AI Agent. I can show you analytics, surface insights, and manage your task queue — or you can type a free-form question and I'll do my best to answer. Try one of the views below to get started.",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminAgentWorkspace({ analytics }: { analytics: AdminAnalytics }) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showTrends, setShowTrends] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const k = analytics.kpis;
  const revDelta = momDelta(revenueSeries(analytics.trends));
  const kpiCards = [
    { label: "Certs issued (YTD)", value: String(k.certsYtd), sub: `Across ${k.certTypeCount} credential type${k.certTypeCount === 1 ? "" : "s"}`, trend: "up" as const },
    { label: "Active members", value: String(k.goodStanding), sub: `${k.totalMembers} total members`, trend: "flat" as const },
    { label: "Revenue (MTD)", value: formatUsd(k.revenueMtdCents / 100), sub: `${formatUsd(k.revenueYtdCents / 100)} YTD`, delta: revDelta.delta, trend: revDelta.trend },
    { label: "Open work items", value: String(k.openItems), sub: "Across all staff queues", trend: "flat" as const },
  ];

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy]);

  // Scripted suggestion click
  function handleSuggestion(s: Suggestion) {
    if (busy) return;
    setNotice(null);
    const userMsg: ChatMessage = { role: "user", text: s.prompt };
    const assistantMsg: ArtifactMessage = {
      role: "assistant",
      text: s.assistantIntro,
      artifact: s.artifactKey,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();
  }

  // Free-text send → real API
  async function handleSend(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || busy) return;
    setNotice(null);
    setInput("");
    setBusy(true);

    const userMsg: ChatMessage = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    // Build API payload (text messages only)
    const apiMessages = [...messages, userMsg]
      .filter((m): m is TextMessage => !m.artifact)
      .map(({ role, text }) => ({ role, content: text }));

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "admin", messages: apiMessages }),
      });

      if (res.status === 503) {
        setNotice("The AI isn't configured yet — but try a suggested view above for a rich demo experience.");
        setBusy(false);
        return;
      }
      if (res.status === 401) {
        setNotice("Your session expired — please sign in again.");
        setBusy(false);
        return;
      }
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(data.message ?? "Too many requests — please wait a moment and try again.");
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(data.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }

      const data = (await res.json()) as { reply?: string };
      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: data.reply ?? "(no response)",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setNotice("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top bar: live KPI context + Trends toggle (top-right) */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Live overview</p>
        <button
          type="button"
          onClick={() => setShowTrends((v) => !v)}
          aria-pressed={showTrends}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            showTrends ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand hover:text-brand",
          )}
        >
          <TrendingUp className="h-4 w-4" aria-hidden />
          {showTrends ? "Hide trends" : "Trends"}
        </button>
      </div>

      {/* KPI strip (real data) */}
      <StatCardRow>
        {kpiCards.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} delta={kpi.delta} trend={kpi.trend} menu />
        ))}
      </StatCardRow>

      {/* Trends panel (real data) */}
      {showTrends && <TrendsPanel analytics={analytics} />}

      {/* Two-column workspace */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main conversation — 2 cols */}
        <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-line bg-bg lg:col-span-2">
          {/* Conversation scroll area */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto p-5"
            style={{ maxHeight: "68vh", minHeight: "360px" }}
          >
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[14px] text-white">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={i} className="space-y-3">
                  {/* Text bubble */}
                  {msg.text && (
                    <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}

                  {/* Artifact (first message: show suggestion chips) */}
                  {!msg.artifact && i === 0 && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Suggested views
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s.artifactKey}
                            type="button"
                            onClick={() => handleSuggestion(s)}
                            disabled={busy}
                            className={cn(
                              "rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink",
                              "transition-colors hover:border-brand hover:text-brand disabled:opacity-50",
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rendered artifact */}
                  {msg.artifact && (
                    <div className="max-w-full">
                      {ARTIFACT_REGISTRY[msg.artifact].render(analytics)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking indicator */}
            {busy && (
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted max-w-[40%]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            )}

            {/* Notice */}
            {notice && (
              <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-2.5 text-[13px] text-muted">
                {notice}
              </div>
            )}
          </div>

          {/* Persistent suggestion chips (after first greeting) */}
          {messages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-line px-5 py-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.artifactKey}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  disabled={busy}
                  className={cn(
                    "whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted",
                    "transition-colors hover:border-brand hover:text-brand disabled:opacity-50",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-line bg-surface p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about members, revenue, tasks, or any admin question…"
                className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-bg px-4 py-2.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <button
                type="button"
                onClick={() => void handleSend(input)}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between px-0.5 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" aria-hidden />
                Powered by Phoenix Creative Works
              </span>
              <span>Read-only context · actions audited</span>
            </div>
          </div>
        </div>

        {/* Task Rail — right column */}
        <div className="overflow-y-auto" style={{ maxHeight: "80vh" }}>
          <TaskRail />
        </div>
      </div>
    </div>
  );
}
