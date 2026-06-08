/**
 * "Tasks for you" — a read-only card list of admin-assigned tasks surfaced to
 * the member. Each task renders its title, optional detail, a priority chip
 * (low / normal / high), a status chip (open / in_progress / done / cancelled),
 * and an optional due date that is highlighted when overdue (past + not done).
 * A friendly empty state is shown when nothing is assigned.
 *
 * Members are read-only this round — there are no actions on these cards.
 */

export type MemberTaskPriority = "low" | "normal" | "high";
export type MemberTaskStatus = "open" | "in_progress" | "done" | "cancelled";

export interface MemberTask {
  id: string;
  title: string | null;
  detail: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
}

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

const PRIORITY_BADGE: Record<MemberTaskPriority, string> = {
  low: "border-line text-muted",
  normal: "border-info/40 bg-info/10 text-info",
  high: "border-accent/50 bg-accent/10 text-accent-strong",
};

const PRIORITY_LABEL: Record<MemberTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const STATUS_BADGE: Record<MemberTaskStatus, string> = {
  open: "border-line text-muted",
  in_progress: "border-info/40 bg-info/10 text-info",
  done: "border-success/40 bg-success/10 text-success",
  cancelled: "border-line bg-surface/60 text-muted",
};

const STATUS_LABEL: Record<MemberTaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

function priorityOf(value: string | null): MemberTaskPriority {
  return value === "low" || value === "high" ? value : "normal";
}

function statusOf(value: string | null): MemberTaskStatus {
  return value === "in_progress" || value === "done" || value === "cancelled"
    ? value
    : "open";
}

export function MemberTasksCard({ tasks }: { tasks: MemberTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface/60 p-8 text-center">
        <div className="text-3xl" aria-hidden>
          ✅
        </div>
        <h3 className="mt-2 text-lg font-semibold text-ink">Nothing assigned right now</h3>
        <p className="mt-1 text-sm text-muted">
          When ABCAC assigns you a task, it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => {
        const priority = priorityOf(task.priority);
        const status = statusOf(task.status);
        const isClosed = status === "done" || status === "cancelled";
        const days = task.due_date ? daysUntil(task.due_date) : null;
        const overdue = !isClosed && days !== null && days < 0;
        return (
          <li
            key={task.id}
            className={`rounded-xl border p-5 transition-colors ${
              overdue
                ? "border-accent bg-accent/10"
                : isClosed
                  ? "border-line bg-surface/60"
                  : "border-line bg-surface hover:border-accent"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-base font-semibold ${
                  isClosed ? "text-muted line-through" : "text-ink"
                }`}
              >
                {task.title?.trim() || "Untitled task"}
              </h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_BADGE[priority]}`}
              >
                {PRIORITY_LABEL[priority]}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[status]}`}
              >
                {STATUS_LABEL[status]}
              </span>
            </div>
            {task.detail && <p className="mt-1 text-sm text-muted">{task.detail}</p>}
            {task.due_date && (
              <p
                className={`mt-1.5 text-xs font-semibold ${
                  overdue ? "text-accent-strong" : "text-muted"
                }`}
              >
                {overdue
                  ? `Overdue · was due ${fmtDate(task.due_date)}`
                  : `Due ${fmtDate(task.due_date)}`}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
