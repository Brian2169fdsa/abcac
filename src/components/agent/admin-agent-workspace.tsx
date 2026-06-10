"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
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
  ADMIN_KPIS,
  CERTS_BY_MONTH,
  CERTS_BY_TYPE,
  REVENUE_BY_STREAM,
  REVENUE_BY_MONTH,
  MOCK_MEMBERS,
  MOCK_TASKS,
  INSIGHTS,
  type MockMember,
} from "@/lib/mock/agent-data";
import { TaskRail } from "@/components/agent/task-rail";

// ── Artifact helpers ─────────────────────────────────────────────────────────

function ArtifactCertSales(): ReactNode {
  const topCerts = CERTS_BY_TYPE.slice(0, 3);
  const totalSold = CERTS_BY_TYPE.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-5">
      {/* Mini KPIs */}
      <StatCardRow>
        <StatCard
          label="Total certs (YTD)"
          value={String(totalSold)}
          sub="All credential types"
          delta="+12% vs last yr"
          trend="up"
        />
        <StatCard
          label="Top credential"
          value={topCerts[0].label}
          sub={`${topCerts[0].value} issued`}
          trend="up"
        />
        <StatCard
          label="Fastest growing"
          value="Reciprocity"
          sub="+34% YoY"
          trend="up"
        />
        <StatCard
          label="Avg certs / month"
          value={String(Math.round(CERTS_BY_MONTH.reduce((s, d) => s + d.value, 0) / CERTS_BY_MONTH.length))}
          sub="Last 12 months"
          trend="flat"
        />
      </StatCardRow>

      {/* Type mix toggle */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Credential mix
        </div>
        <ToggleChart
          options={["Bar chart", "Donut"]}
          render={(selected) =>
            selected === "Bar chart" ? (
              <BarChart data={CERTS_BY_TYPE} height={220} />
            ) : (
              <DonutChart
                data={CERTS_BY_TYPE}
                centerLabel={String(totalSold)}
                centerSub="total"
              />
            )
          }
        />
      </div>

      {/* Monthly trend */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Monthly volume (12 mo)
        </div>
        <BarChart data={CERTS_BY_MONTH} height={180} showLegend={false} rotateLabels />
      </div>

      <InsightCallout>{INSIGHTS.certMix}</InsightCallout>
    </div>
  );
}

function ArtifactRevenue(): ReactNode {
  const total = REVENUE_BY_STREAM.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-5">
      {/* Toggle: donut vs bar for streams */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Revenue by stream (MTD)
        </div>
        <ToggleChart
          options={["Donut", "Bar chart"]}
          render={(selected) =>
            selected === "Donut" ? (
              <DonutChart
                data={REVENUE_BY_STREAM}
                format={formatMoneyCompact}
                centerLabel={formatMoneyCompact(total)}
                centerSub="MTD"
              />
            ) : (
              <BarChart
                data={REVENUE_BY_STREAM}
                height={220}
                format={formatMoneyCompact}
              />
            )
          }
        />
      </div>

      {/* Monthly trend */}
      <div>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted">
          Revenue trend (12 mo)
        </div>
        <BarChart
          data={REVENUE_BY_MONTH}
          height={180}
          format={formatMoneyCompact}
          showLegend={false}
          rotateLabels
        />
      </div>

      <InsightCallout>{INSIGHTS.revenue}</InsightCallout>
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

function ArtifactAttention(): ReactNode {
  const highTasks = MOCK_TASKS.filter((t) => t.priority === "high");

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
        High priority — {highTasks.length} items
      </div>
      <div className="space-y-3">
        {highTasks.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-lg border border-[#C0432F]/20 bg-[#C0432F]/[0.03] p-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#C0432F]" aria-hidden />
            <div>
              <p className="text-[13px] font-semibold text-ink">{t.title}</p>
              <p className="mt-0.5 text-[12px] text-muted">{t.detail}</p>
              <p className="mt-1 text-[11px] font-medium text-[#C0432F]">{t.due}</p>
            </div>
          </div>
        ))}
      </div>
      <InsightCallout>{INSIGHTS.tasks}</InsightCallout>
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
      <InsightCallout>{INSIGHTS.recert}</InsightCallout>
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

const ARTIFACT_REGISTRY: Record<ArtifactKey, { label: string; render: () => ReactNode }> = {
  "cert-sales": {
    label: "Certification sales overview",
    render: () => <ArtifactCertSales />,
  },
  revenue: {
    label: "Revenue this month",
    render: () => <ArtifactRevenue />,
  },
  members: {
    label: "Member directory",
    render: () => <ArtifactMembers />,
  },
  attention: {
    label: "Items needing attention",
    render: () => <ArtifactAttention />,
  },
  automate: {
    label: "Automatable tasks",
    render: () => <ArtifactAutomate />,
  },
};

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

export function AdminAgentWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {/* KPI strip */}
      <StatCardRow>
        {ADMIN_KPIS.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            delta={kpi.delta}
            trend={kpi.trend}
            menu
          />
        ))}
      </StatCardRow>

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
                      {ARTIFACT_REGISTRY[msg.artifact].render()}
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
