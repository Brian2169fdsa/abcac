"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToggleChart,
  BarChart,
  DonutChart,
  InsightCallout,
} from "@/components/agent/charts";
import {
  MEMBER_CEU_PROGRESS,
  MEMBER_CEU_BY_CATEGORY,
  MEMBER_TASKS_DEMO,
  type MemberTaskDemo,
} from "@/lib/mock/agent-data";

// ── Priority display helpers ───────────────────────────────────────────────

type Priority = MemberTaskDemo["priority"];

const PRIORITY_CHIP: Record<Priority, string> = {
  high: "border-accent/50 bg-accent/10 text-accent-strong",
  medium: "border-info/40 bg-info/10 text-info",
  low: "border-line text-muted",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_ICON: Record<Priority, React.ReactNode> = {
  high: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
  medium: <Info className="h-3.5 w-3.5" aria-hidden />,
  low: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
};

// ── CEU totals ─────────────────────────────────────────────────────────────

const totalCeuHours = MEMBER_CEU_BY_CATEGORY.reduce((s, d) => s + d.value, 0);

// ── Task card component ────────────────────────────────────────────────────

function TaskCard({ task }: { task: MemberTaskDemo }) {
  // `task.due` is a human-readable display string (e.g. "Due in 7 days",
  // "Window opens in 60 days"), not a parseable date — render it directly.
  const isUrgent = task.priority === "high";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-surface p-5 transition-colors",
        isUrgent ? "border-accent/50 hover:border-accent" : "border-line hover:border-info/60",
      )}
    >
      {/* Priority chip */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            PRIORITY_CHIP[task.priority],
          )}
        >
          {PRIORITY_ICON[task.priority]}
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {/* Title + detail */}
      <div className="flex-1">
        <h3 className="text-base font-semibold text-ink">{task.title}</h3>
        <p className="mt-1 text-sm text-muted">{task.detail}</p>
      </div>

      {/* Due date + CTA */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            isUrgent ? "text-accent-strong" : "text-muted",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {task.due}
        </div>
        <Link
          href={task.href}
          className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-surface"
        >
          {task.cta}
        </Link>
      </div>
    </li>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function MemberAgentPanel() {
  return (
    <div className="space-y-8">
      {/* Intro line */}
      <p className="text-base text-muted">
        Your certification at a glance — track CEU progress and stay on top of what's due next.
      </p>

      {/* CEU Analytics ─────────────────────────────────────────────────── */}
      <section aria-labelledby="ceu-analytics-heading">
        <h3
          id="ceu-analytics-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          CEU Hours — Current Cycle
        </h3>

        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <ToggleChart
            options={["Progress", "By category"]}
            render={(active) =>
              active === "Progress" ? (
                <BarChart
                  data={MEMBER_CEU_PROGRESS}
                  height={200}
                />
              ) : (
                <DonutChart
                  data={MEMBER_CEU_BY_CATEGORY}
                  centerLabel={String(totalCeuHours)}
                  size={180}
                />
              )
            }
          />

          <InsightCallout>
            You&rsquo;re 4 hours from completing this cycle&rsquo;s CEU requirement &mdash; two short
            courses would close it. Check out the{" "}
            <Link href="/account/ceus" className="font-semibold text-brand hover:underline">
              CEU portal
            </Link>{" "}
            for approved providers.
          </InsightCallout>
        </div>
      </section>

      {/* Personalized task cards ───────────────────────────────────────── */}
      <section aria-labelledby="demo-tasks-heading">
        <h3
          id="demo-tasks-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Recommended Actions
        </h3>

        <ul className="grid gap-4 sm:grid-cols-2">
          {MEMBER_TASKS_DEMO.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      </section>
    </div>
  );
}
