"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  upsertEmployment,
  deleteEmployment,
  type EmploymentInput,
} from "@/app/(admin)/admin/members/[id]/records-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

/** Pull the typed employment payload out of an uncontrolled form. */
function readForm(form: HTMLFormElement): EmploymentInput {
  const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
  return {
    employer_name: get("employer_name"),
    position_title: get("position_title"),
    start_date: get("start_date") || null,
    end_date: get("end_date") || null,
    is_current: (form.elements.namedItem("is_current") as HTMLInputElement | null)?.checked ?? false,
  };
}

/** One inline-editable employment row plus a delete control. */
function EmploymentEditRow({ memberId, row }: { memberId: string; row: any }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const payload = readForm(e.currentTarget);
    if (!payload.employer_name.trim() || !payload.position_title.trim()) {
      setFeedback({ ok: false, text: "Employer and position are required." });
      return;
    }
    startTransition(async () => {
      const res = await upsertEmployment(memberId, { ...payload, id: row.id });
      if (res.ok) {
        setFeedback({ ok: true, text: "Saved." });
        router.refresh();
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this employment record?")) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteEmployment(memberId, row.id);
      if (res.ok) {
        router.refresh();
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form
      onSubmit={onSave}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Employer
          </span>
          <input name="employer_name" defaultValue={row.employer_name ?? ""} className={field} disabled={pending} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Position
          </span>
          <input name="position_title" defaultValue={row.position_title ?? ""} className={field} disabled={pending} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Start date
          </span>
          <input name="start_date" type="date" defaultValue={row.start_date ?? ""} className={field} disabled={pending} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            End date
          </span>
          <input name="end_date" type="date" defaultValue={row.end_date ?? ""} className={field} disabled={pending} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input name="is_current" type="checkbox" defaultChecked={!!row.is_current} disabled={pending} className="h-4 w-4 rounded border-line text-brand focus-visible:ring-brand" />
        Current employer
      </label>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDelete} disabled={pending}>
          Delete
        </Button>
      </div>
    </form>
  );
}

/** Add-a-new-employment-record form. */
function AddEmploymentForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const payload = readForm(form);
    if (!payload.employer_name.trim() || !payload.position_title.trim()) {
      setFeedback({ ok: false, text: "Employer and position are required." });
      return;
    }
    startTransition(async () => {
      const res = await upsertEmployment(memberId, payload);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Employment record added." });
        router.refresh();
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface p-5"
    >
      <div className="text-sm font-semibold text-ink">Add employment record</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="employer_name" placeholder="Employer" className={field} disabled={pending} />
        <input name="position_title" placeholder="Position title" className={field} disabled={pending} />
        <input name="start_date" type="date" className={field} disabled={pending} aria-label="Start date" />
        <input name="end_date" type="date" className={field} disabled={pending} aria-label="End date" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input name="is_current" type="checkbox" disabled={pending} className="h-4 w-4 rounded border-line text-brand focus-visible:ring-brand" />
        Current employer
      </label>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add record"}
      </Button>
    </form>
  );
}

/**
 * Admin management of a member's employment history. Lists each
 * `employment_records` row as an inline-editable card with delete, plus an
 * add form. All writes go through admin-gated, audited server actions.
 */
export function MemberEmploymentManage({
  memberId,
  rows,
}: {
  memberId: string;
  rows: any[];
}) {
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
          No employment records yet. Add one below.
        </p>
      ) : (
        rows.map((row) => <EmploymentEditRow key={row.id} memberId={memberId} row={row} />)
      )}
      <AddEmploymentForm memberId={memberId} />
    </div>
  );
}
