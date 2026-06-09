"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  upsertSupervisionRecord,
  deleteSupervisionRecord,
  setSupervisee,
} from "@/app/(admin)/admin/members/[id]/supervision-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

type RecordForm = {
  superviseeName: string;
  superviseeCredential: string;
  startDate: string;
  endDate: string;
  status: string;
};

const EMPTY_FORM: RecordForm = {
  superviseeName: "",
  superviseeCredential: "",
  startDate: "",
  endDate: "",
  status: "active",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const parts = d.slice(0, 10).split("-").map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m, day] = parts;
    return new Date(y, m - 1, day).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return d;
}

function readForm(form: HTMLFormElement): RecordForm {
  return {
    superviseeName: (form.elements.namedItem("superviseeName") as HTMLInputElement).value.trim(),
    superviseeCredential: (form.elements.namedItem("superviseeCredential") as HTMLInputElement).value.trim(),
    startDate: (form.elements.namedItem("startDate") as HTMLInputElement).value,
    endDate: (form.elements.namedItem("endDate") as HTMLInputElement).value,
    status: (form.elements.namedItem("status") as HTMLSelectElement).value,
  };
}

/**
 * Admin management of the supervision records THIS member provides (the member
 * is the supervisor). Add / inline-edit / delete records, plus a field to link a
 * supervisee's ABCAC member account (`supervisee_member_id`) so the supervisee
 * can see the relationship. All writes go through admin-gated server actions;
 * this component only carries UI state.
 */
export function MemberSupervisionManage({
  memberId,
  records,
}: {
  memberId: string;
  records: any[];
}) {
  const sorted = useMemo(
    () =>
      [...(records ?? [])].sort((a, b) => {
        const aS = a?.start_date ?? "";
        const bS = b?.start_date ?? "";
        return bS.localeCompare(aS);
      }),
    [records],
  );

  return (
    <div className="space-y-4">
      <AddRecordForm memberId={memberId} />
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-sm text-muted">
          No supervision records.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((rec) => (
            <RecordRow key={rec.id} memberId={memberId} rec={rec} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddRecordForm({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const f = readForm(form);
    if (!f.superviseeName) {
      setFeedback({ ok: false, text: "Enter a supervisee name." });
      return;
    }
    startTransition(async () => {
      const res = await upsertSupervisionRecord(memberId, f);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Supervision record added." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="text-sm font-semibold text-ink">Add a supervision record</div>
      <RecordFields pending={pending} />
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add record"}
      </Button>
    </form>
  );
}

function RecordFields({ pending, value }: { pending: boolean; value?: RecordForm }) {
  const v = value ?? EMPTY_FORM;
  return (
    <>
      <input
        name="superviseeName"
        defaultValue={v.superviseeName}
        placeholder="Supervisee name"
        className={field}
        disabled={pending}
      />
      <input
        name="superviseeCredential"
        defaultValue={v.superviseeCredential}
        placeholder="Supervisee credential (optional)"
        className={field}
        disabled={pending}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Start date
          <input type="date" name="startDate" defaultValue={v.startDate} className={field} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          End date
          <input type="date" name="endDate" defaultValue={v.endDate} className={field} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Status
          <select name="status" defaultValue={v.status || "active"} className={field} disabled={pending}>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
    </>
  );
}

function RecordRow({ memberId, rec }: { memberId: string; rec: any }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setFeedback({ ok: false, text: "Failed: " + res.error });
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-line bg-surface p-5">
        <EditRecordForm
          rec={rec}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(fields) =>
            run(async () => {
              const res = await upsertSupervisionRecord(memberId, { ...fields, id: rec.id });
              if (res.ok) setEditing(false);
              return res;
            })
          }
        />
        {feedback && !feedback.ok && <p className="mt-2 text-sm text-red-600">{feedback.text}</p>}
      </li>
    );
  }

  const linked = Boolean(rec.supervisee_member_id);

  return (
    <li className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{rec.supervisee_name || "—"}</span>
            {rec.supervisee_credential && (
              <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted">
                {rec.supervisee_credential}
              </span>
            )}
            <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-semibold capitalize text-muted">
              {rec.status || "active"}
            </span>
            {linked ? (
              <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                Linked account
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted">
                Off-platform
              </span>
            )}
          </div>
          {(rec.start_date || rec.end_date) && (
            <p className="mt-1 text-xs font-semibold text-muted">
              {fmtDate(rec.start_date)}
              {rec.end_date ? " – " + fmtDate(rec.end_date) : ""}
            </p>
          )}
          <SuperviseeLink
            memberId={memberId}
            rec={rec}
            pending={pending}
            onRun={run}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("Delete this supervision record?")) return;
              run(() => deleteSupervisionRecord(memberId, rec.id));
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

function SuperviseeLink({
  memberId,
  rec,
  pending,
  onRun,
}: {
  memberId: string;
  rec: any;
  pending: boolean;
  onRun: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const [value, setValue] = useState<string>(rec.supervisee_member_id ?? "");
  const linked = Boolean(rec.supervisee_member_id);

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
        Link supervisee account (member id)
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Supervisee profile UUID"
          className={field}
          disabled={pending}
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || value.trim() === (rec.supervisee_member_id ?? "")}
        onClick={() => onRun(() => setSupervisee(memberId, rec.id, value.trim() || null))}
      >
        {value.trim() ? "Link" : "Save"}
      </Button>
      {linked && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setValue("");
            onRun(() => setSupervisee(memberId, rec.id, null));
          }}
        >
          Unlink
        </Button>
      )}
    </div>
  );
}

function EditRecordForm({
  rec,
  pending,
  onCancel,
  onSave,
}: {
  rec: any;
  pending: boolean;
  onCancel: () => void;
  onSave: (fields: RecordForm) => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const value: RecordForm = {
    superviseeName: rec.supervisee_name ?? "",
    superviseeCredential: rec.supervisee_credential ?? "",
    startDate: rec.start_date ? rec.start_date.slice(0, 10) : "",
    endDate: rec.end_date ? rec.end_date.slice(0, 10) : "",
    status: rec.status ?? "active",
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const f = readForm(e.currentTarget);
    if (!f.superviseeName) {
      setLocalError("Enter a supervisee name.");
      return;
    }
    onSave(f);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-ink">Edit supervision record</div>
      <RecordFields pending={pending} value={value} />
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
