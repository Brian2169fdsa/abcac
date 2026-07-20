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
import type { ComplianceResult } from "@/lib/ceu-compliance";
import type { MemberTask } from "@/components/dashboard/member-tasks-card";

// ── Priority display helpers ───────────────────────────────────────────────

type Priority = "high" | "medium" | "low";

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

/** member_tasks stores low / normal / high — anything unknown reads as medium. */
function priorityOf(value: string | null): Priority {
  return value === "high" ? "high" : value === "low" ? "low" : "medium";
}

function fmtDue(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hoursLabel(n: number): string {
  return `${n} hour${n === 1 ? "" : "s"}`;
}

// ── Task card component ────────────────────────────────────────────────────

function TaskCard({ task }: { task: MemberTask }) {
  const priority = priorityOf(task.priority);
  const isUrgent = priority === "high";

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
            PRIORITY_CHIP[priority],
          )}
        >
          {PRIORITY_ICON[priority]}
          {PRIORITY_LABEL[priority]}
        </span>
      </div>

      {/* Title + detail */}
      <div className="flex-1">
        <h3 className="text-base font-semibold text-ink">
          {task.title?.trim() || "Untitled task"}
        </h3>
        {task.detail && <p className="mt-1 text-sm text-muted">{task.detail}</p>}
      </div>

      {/* Due date */}
      {task.due_date && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              isUrgent ? "text-accent-strong" : "text-muted",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Due {fmtDue(task.due_date)}
          </div>
        </div>
      )}
    </li>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export interface MemberAgentPanelProps {
  /** Real CEU compliance for the member's primary credential (from the page). */
  ceu: ComplianceResult;
  /** Real open admin-assigned tasks (member_tasks rows, status = open). */
  tasks: MemberTask[];
}

export function MemberAgentPanel({ ceu, tasks }: MemberAgentPanelProps) {
  // Approved vs required, from real compliance numbers.
  const progressData = [
    { label: "Approved", value: ceu.totalApproved },
    { label: "Required", value: ceu.requiredTotal },
  ];

  // Category donut: use the real ethics / cultural breakdown when any of those
  // hours exist; otherwise fall back to approved vs remaining — never invent
  // categories the member hasn't logged.
  const generalApproved = Math.max(0, ceu.totalApproved - ceu.ethics - ceu.cultural);
  const hasCategoryData = ceu.ethics > 0 || ceu.cultural > 0;
  const categoryData = (
    hasCategoryData
      ? [
          { label: "Ethics", value: ceu.ethics },
          { label: "Cultural Diversity", value: ceu.cultural },
          { label: "General", value: generalApproved },
        ]
      : [
          { label: "Approved", value: ceu.totalApproved },
          { label: "Remaining", value: ceu.remaining },
        ]
  ).filter((d) => d.value > 0);

  const categoryShortfalls = [
    ceu.ethicsRemaining > 0 ? `${hoursLabel(ceu.ethicsRemaining)} of ethics` : null,
    ceu.culturalRemaining > 0
      ? `${hoursLabel(ceu.culturalRemaining)} of cultural diversity`
      : null,
  ].filter((s): s is string => s !== null);

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
                  data={progressData}
                  height={200}
                />
              ) : (
                <DonutChart
                  data={categoryData}
                  centerLabel={String(ceu.totalApproved)}
                  centerSub={`of ${ceu.requiredTotal} hrs`}
                  size={180}
                />
              )
            }
          />

          <InsightCallout>
            {ceu.compliant ? (
              <>
                You&rsquo;ve completed this cycle&rsquo;s CEU requirement &mdash;{" "}
                {ceu.totalApproved} of {ceu.requiredTotal} approved hours, with the ethics and
                cultural diversity minimums met. Nice work.
              </>
            ) : (
              <>
                {ceu.remaining > 0 ? (
                  <>
                    You&rsquo;re {hoursLabel(ceu.remaining)} from completing this cycle&rsquo;s{" "}
                    {ceu.requiredTotal}-hour CEU requirement ({ceu.totalApproved} approved so
                    far).
                  </>
                ) : (
                  <>
                    Your {ceu.requiredTotal} total hours are approved, but a category minimum is
                    still open.
                  </>
                )}
                {categoryShortfalls.length > 0 && (
                  <> That includes {categoryShortfalls.join(" and ")} still needed.</>
                )}{" "}
                Check out the{" "}
                <Link href="/account/ceus" className="font-semibold text-brand hover:underline">
                  CEU portal
                </Link>{" "}
                for approved providers.
              </>
            )}
          </InsightCallout>
        </div>
      </section>

      {/* Open tasks assigned to the member ─────────────────────────────── */}
      <section aria-labelledby="open-tasks-heading">
        <h3
          id="open-tasks-heading"
          className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted"
        >
          Recommended Actions
        </h3>

        {tasks.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
            No open tasks &mdash; you&rsquo;re all caught up.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
