import Link from "next/link";
import type { PlanStep, PlanStatus } from "@/lib/member-plan";

/**
 * "Your Next Steps" — a guided checklist/timeline of cards on the home
 * dashboard showing the member exactly what to do next toward certification or
 * renewal. Each step renders its title, detail, an optional due date (with an
 * overdue highlight), and a CTA link. When every step is done, a friendly
 * "all caught up" state is shown.
 */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

export function NextSteps({ steps }: { steps: PlanStep[] }) {
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");

  if (steps.length === 0 || allDone) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-8 text-center">
        <div className="text-3xl" aria-hidden>
          🎉
        </div>
        <h3 className="mt-2 text-lg font-semibold text-ink">You&apos;re all caught up</h3>
        <p className="mt-1 text-sm text-muted">
          There&apos;s nothing you need to do right now. We&apos;ll let you know when there is.
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
            className={`rounded-xl border p-5 transition-colors ${
              overdue
                ? "border-accent bg-accent/10"
                : isDone
                  ? "border-line bg-surface/60"
                  : "border-line bg-surface hover:border-accent"
            }`}
          >
            <div className="flex items-start gap-4">
              <StepCheck status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`text-base font-semibold ${
                      isDone ? "text-muted line-through" : "text-ink"
                    }`}
                  >
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
                  <p
                    className={`mt-1.5 text-xs font-semibold ${
                      overdue ? "text-accent-strong" : "text-muted"
                    }`}
                  >
                    {overdue
                      ? `Overdue · was due ${fmtDate(step.dueDate)}`
                      : `Due ${fmtDate(step.dueDate)}`}
                  </p>
                )}
              </div>
              {!isDone && (
                <Link
                  href={step.href}
                  className="flex-shrink-0 self-center text-sm font-semibold text-brand hover:text-brand-600"
                >
                  {step.id === "renew-certification"
                    ? "Renew →"
                    : step.id === "earn-ceus"
                      ? "Log CEUs →"
                      : "Go →"}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
