import type { PlanStep, PlanStatus } from "@/lib/member-plan";

/**
 * ADMIN MIRROR — the member's guided "Your Next Steps" plan, rendered exactly
 * as the client is shown it on their dashboard (see
 * src/components/dashboard/next-steps.tsx), but read-only: no CTA links, since
 * the admin is viewing the member's experience rather than acting as them.
 *
 * Accepts a pre-built PlanStep[] (assembled on the page via buildMemberPlan).
 */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

const STATUS_DOT: Record<PlanStatus, string> = {
  done: "border-success bg-success",
  in_progress: "border-info bg-info",
  todo: "border-accent bg-surface",
};

const STATUS_LABEL: Record<PlanStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  todo: "To do",
};

const STATUS_BADGE: Record<PlanStatus, string> = {
  done: "border-success/40 bg-success/10 text-success",
  in_progress: "border-info/40 bg-info/10 text-info",
  todo: "border-line text-muted",
};

function StepCheck({ status }: { status: PlanStatus }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white ${STATUS_DOT[status]}`}
    >
      {status === "done" ? "✓" : ""}
    </span>
  );
}

export function MemberPlanPanel({ steps }: { steps: PlanStep[] }) {
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");

  if (steps.length === 0 || allDone) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-8 text-center">
        <div className="text-3xl" aria-hidden>
          🎉
        </div>
        <h3 className="mt-2 text-lg font-semibold text-ink">This member is all caught up</h3>
        <p className="mt-1 text-sm text-muted">
          There&apos;s nothing the member needs to do right now — every guided step is complete.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => {
        const isDone = step.status === "done";
        const days = step.dueDate ? daysUntil(step.dueDate) : null;
        const overdue = days !== null && days < 0;
        return (
          <li
            key={step.id}
            className={`rounded-xl border p-5 ${
              overdue
                ? "border-accent bg-accent/10"
                : isDone
                  ? "border-line bg-surface/60"
                  : "border-line bg-surface"
            }`}
          >
            <div className="flex items-start gap-4">
              <StepCheck status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`text-base font-semibold ${isDone ? "text-muted line-through" : "text-ink"}`}>
                    {step.title}
                  </h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[step.status]}`}
                  >
                    {STATUS_LABEL[step.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{step.detail}</p>
                {step.dueDate && (
                  <p className={`mt-1.5 text-xs font-semibold ${overdue ? "text-accent-strong" : "text-muted"}`}>
                    {overdue ? `Overdue · was due ${fmtDate(step.dueDate)}` : `Due ${fmtDate(step.dueDate)}`}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
