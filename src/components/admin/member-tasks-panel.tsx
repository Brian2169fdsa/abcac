"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createMemberTask,
  setMemberTaskStatus,
  updateMemberTask,
  deleteMemberTask,
} from "@/app/(admin)/admin/members/[id]/task-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const area =
  "w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export type MemberTask = {
  id: string;
  member_id: string;
  title: string;
  detail: string | null;
  status: "open" | "in_progress" | "done" | "cancelled" | string;
  priority: "low" | "normal" | "high" | string;
  due_date: string | null;
  visible_to_member: boolean | null;
  created_at?: string | null;
  completed_at?: string | null;
};

type Feedback = { ok: boolean; text: string } | null;

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  // due_date is a plain date — parse as local to avoid TZ drift.
  const parts = d.slice(0, 10).split("-").map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m, day] = parts;
    return new Date(y, m - 1, day).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isOverdue(task: MemberTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  const parts = task.due_date.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [y, m, day] = parts;
  const due = new Date(y, m - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function isActive(status: string): boolean {
  return status === "open" || status === "in_progress";
}

/** Sort: active (open/in_progress) first by due date (nulls last), then done/cancelled. */
function sortTasks(tasks: MemberTask[]): MemberTask[] {
  return [...tasks].sort((a, b) => {
    const aActive = isActive(a.status);
    const bActive = isActive(b.status);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive) {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      const aP = PRIORITY_RANK[a.priority] ?? 1;
      const bP = PRIORITY_RANK[b.priority] ?? 1;
      return aP - bP;
    }
    // Completed/cancelled: most recently completed first.
    const aC = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bC = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bC - aC;
  });
}

function PriorityChip({ priority }: { priority: string }) {
  const tone =
    priority === "high"
      ? "bg-brand text-white"
      : priority === "low"
        ? "border border-line text-muted"
        : "bg-accent text-ink";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {priority || "normal"}
    </span>
  );
}

/**
 * The member cockpit Tasks panel — the ClickUp replacement. An "Add task" form
 * plus the member's task list with status cycling, edit, and delete. All writes
 * go through admin-gated server actions; this component only carries UI state.
 */
export function MemberTasksPanel({ memberId, tasks }: { memberId: string; tasks: MemberTask[] }) {
  const sorted = useMemo(() => sortTasks(tasks), [tasks]);

  return (
    <div className="space-y-4">
      <AddTaskForm memberId={memberId} />
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-sm text-muted">
          No tasks yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddTaskForm({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const detail = (form.elements.namedItem("detail") as HTMLTextAreaElement).value.trim();
    const dueDate = (form.elements.namedItem("due_date") as HTMLInputElement).value;
    const priority = (form.elements.namedItem("priority") as HTMLSelectElement).value;
    const visibleToMember = (form.elements.namedItem("visible_to_member") as HTMLInputElement).checked;
    if (!title) {
      setFeedback({ ok: false, text: "Enter a task title." });
      return;
    }
    startTransition(async () => {
      const res = await createMemberTask(memberId, { title, detail, dueDate, priority, visibleToMember });
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Task added." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="text-sm font-semibold text-ink">Add a task</div>
      <input name="title" placeholder="Task title" className={field} disabled={pending} />
      <textarea name="detail" rows={2} placeholder="Detail (optional)" className={area} disabled={pending} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Due date
          <input type="date" name="due_date" className={field} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Priority
          <select name="priority" defaultValue="normal" className={field} disabled={pending}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="visible_to_member" className="h-4 w-4 rounded border-line" disabled={pending} />
        Visible to member
      </label>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
    </form>
  );
}

function TaskRow({ task }: { task: MemberTask }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);
  const overdue = isOverdue(task);
  const completed = task.status === "done" || task.status === "cancelled";

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setFeedback({ ok: false, text: "Failed: " + res.error });
    });
  }

  // Next status when advancing the lifecycle: open → in_progress → done.
  const nextStatus = task.status === "open" ? "in_progress" : task.status === "in_progress" ? "done" : null;

  if (editing) {
    return (
      <li className="rounded-xl border border-line bg-surface p-5">
        <EditTaskForm
          task={task}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(fields) =>
            run(async () => {
              const res = await updateMemberTask(task.id, task.member_id, fields);
              if (res.ok) setEditing(false);
              return res;
            })
          }
        />
        {feedback && !feedback.ok && <p className="mt-2 text-sm text-red-600">{feedback.text}</p>}
      </li>
    );
  }

  return (
    <li className={`rounded-xl border bg-surface p-5 ${overdue ? "border-brand" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${completed ? "text-muted line-through" : "text-ink"}`}>
              {task.title}
            </span>
            <PriorityChip priority={task.priority} />
            <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-semibold capitalize text-muted">
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            {task.visible_to_member ? (
              <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">
                Visible to member
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted">
                Internal
              </span>
            )}
          </div>
          {task.detail && <p className="mt-1 text-sm text-muted">{task.detail}</p>}
          {task.due_date && (
            <p className={`mt-1 text-xs font-semibold ${overdue ? "text-brand" : "text-muted"}`}>
              Due {fmtDate(task.due_date)}
              {overdue ? " · Overdue" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {nextStatus && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setMemberTaskStatus(task.id, task.member_id, nextStatus))}
            >
              {nextStatus === "in_progress" ? "Start" : "Complete"}
            </Button>
          )}
          {!completed && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setMemberTaskStatus(task.id, task.member_id, "cancelled"))}
            >
              Cancel
            </Button>
          )}
          {completed && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => setMemberTaskStatus(task.id, task.member_id, "open"))}
            >
              Reopen
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Delete this task?")) return;
              run(() => deleteMemberTask(task.id, task.member_id));
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {feedback && !feedback.ok && <p className="mt-2 text-sm text-red-600">{feedback.text}</p>}
    </li>
  );
}

function EditTaskForm({
  task,
  pending,
  onCancel,
  onSave,
}: {
  task: MemberTask;
  pending: boolean;
  onCancel: () => void;
  onSave: (fields: {
    title: string;
    detail: string;
    dueDate: string;
    priority: string;
    visibleToMember: boolean;
  }) => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
    const detail = (form.elements.namedItem("detail") as HTMLTextAreaElement).value.trim();
    const dueDate = (form.elements.namedItem("due_date") as HTMLInputElement).value;
    const priority = (form.elements.namedItem("priority") as HTMLSelectElement).value;
    const visibleToMember = (form.elements.namedItem("visible_to_member") as HTMLInputElement).checked;
    if (!title) {
      setLocalError("Enter a task title.");
      return;
    }
    onSave({ title, detail, dueDate, priority, visibleToMember });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-ink">Edit task</div>
      <input name="title" defaultValue={task.title} placeholder="Task title" className={field} disabled={pending} />
      <textarea
        name="detail"
        rows={2}
        defaultValue={task.detail ?? ""}
        placeholder="Detail (optional)"
        className={area}
        disabled={pending}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Due date
          <input
            type="date"
            name="due_date"
            defaultValue={task.due_date ? task.due_date.slice(0, 10) : ""}
            className={field}
            disabled={pending}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Priority
          <select name="priority" defaultValue={task.priority || "normal"} className={field} disabled={pending}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="visible_to_member"
          defaultChecked={Boolean(task.visible_to_member)}
          className="h-4 w-4 rounded border-line"
          disabled={pending}
        />
        Visible to member
      </label>
      {localError && <p className="text-sm text-red-600">{localError}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
