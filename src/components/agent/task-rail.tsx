"use client";

import { useState } from "react";
import { Zap, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_TASKS, type MockTask, type TaskPriority } from "@/lib/mock/agent-data";

// ── Priority dot colours ─────────────────────────────────────────────────────

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-[#C0432F]",
  medium: "bg-[#C8741F]",
  low: "bg-[#8A8F98]",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ── Single task card ─────────────────────────────────────────────────────────

function TaskCard({ task }: { task: MockTask }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 opacity-60">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E7D5A]" aria-hidden />
        <span className="text-sm font-medium text-[#2E7D5A] line-through">{task.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface p-4 transition-shadow hover:shadow-sm",
        task.priority === "high" ? "border-[#C0432F]/30" : "border-line",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
          title={`${PRIORITY_LABEL[task.priority]} priority`}
          aria-label={`${PRIORITY_LABEL[task.priority]} priority`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-ink">{task.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{task.detail}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
        <span className="font-medium text-ink/70">{task.member}</span>
        <span aria-hidden>·</span>
        <span>{task.due}</span>
      </div>

      {/* Automatable affordance */}
      {task.automatable && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#1F5FA8]/8 px-2 py-0.5 text-[11px] font-medium text-[#1F5FA8]">
          <Zap className="h-3 w-3" aria-hidden />
          Automatable
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDone(true)}
          className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-ink/80"
        >
          {task.action}
        </button>

        {task.secondary && (
          <button
            type="button"
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-ink/75 transition-colors hover:border-ink/40 hover:text-ink"
          >
            {task.secondary}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </button>
        )}

        {task.automatable && (
          <button
            type="button"
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#1F5FA8]/40 bg-[#1F5FA8]/5 px-3 py-1.5 text-[12px] font-medium text-[#1F5FA8] transition-colors hover:bg-[#1F5FA8]/10"
          >
            <Zap className="h-3 w-3" aria-hidden />
            Automate
          </button>
        )}
      </div>
    </div>
  );
}

// ── TaskRail ─────────────────────────────────────────────────────────────────

export function TaskRail() {
  const total = MOCK_TASKS.length;
  const highCount = MOCK_TASKS.filter((t) => t.priority === "high").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Task Queue
        </h2>
        <span className="text-[12px] text-muted">
          {total} tasks ·{" "}
          <span className="font-semibold text-[#C0432F]">{highCount} high priority</span>
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {MOCK_TASKS.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
