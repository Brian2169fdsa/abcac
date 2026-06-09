"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  upsertAuthorization,
  deleteAuthorization,
} from "@/app/(admin)/admin/members/[id]/supervision-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const area =
  "w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const STATUSES = ["active", "expired", "revoked", "pending"] as const;

type Feedback = { ok: boolean; text: string } | null;

type AuthForm = {
  authorizationType: string;
  detail: string;
  startDate: string;
  endDate: string;
  status: string;
  adminNotes: string;
};

const EMPTY_FORM: AuthForm = {
  authorizationType: "",
  detail: "",
  startDate: "",
  endDate: "",
  status: "active",
  adminNotes: "",
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

function statusTone(status: string): string {
  switch (status) {
    case "active":
      return "bg-accent text-white";
    case "revoked":
      return "bg-brand text-white";
    case "expired":
    case "pending":
    default:
      return "border border-line text-muted";
  }
}

function readForm(form: HTMLFormElement): AuthForm {
  return {
    authorizationType: (form.elements.namedItem("authorizationType") as HTMLInputElement).value.trim(),
    detail: (form.elements.namedItem("detail") as HTMLTextAreaElement).value.trim(),
    startDate: (form.elements.namedItem("startDate") as HTMLInputElement).value,
    endDate: (form.elements.namedItem("endDate") as HTMLInputElement).value,
    status: (form.elements.namedItem("status") as HTMLSelectElement).value,
    adminNotes: (form.elements.namedItem("adminNotes") as HTMLTextAreaElement).value.trim(),
  };
}

/**
 * Admin CRUD for the board-granted supervision AUTHORIZATIONS a member holds
 * (`supervision_authorizations`, migration 030). Add / inline-edit / delete with
 * type, detail, start/end, status, and internal admin notes. All writes go
 * through admin-gated server actions; this component only carries UI state.
 */
export function MemberAuthorizationManage({
  memberId,
  authorizations,
}: {
  memberId: string;
  authorizations: any[];
}) {
  const sorted = useMemo(
    () =>
      [...(authorizations ?? [])].sort((a, b) => {
        const aS = a?.start_date ?? "";
        const bS = b?.start_date ?? "";
        return bS.localeCompare(aS);
      }),
    [authorizations],
  );

  return (
    <div className="space-y-4">
      <AddAuthForm memberId={memberId} />
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-6 text-center text-sm text-muted">
          No supervision authorizations.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((auth) => (
            <AuthRow key={auth.id} memberId={memberId} auth={auth} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddAuthForm({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const f = readForm(form);
    if (!f.authorizationType) {
      setFeedback({ ok: false, text: "Enter an authorization type." });
      return;
    }
    startTransition(async () => {
      const res = await upsertAuthorization(memberId, f);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Authorization added." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="text-sm font-semibold text-ink">Grant a supervision authorization</div>
      <AuthFields pending={pending} />
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add authorization"}
      </Button>
    </form>
  );
}

function AuthFields({ pending, value }: { pending: boolean; value?: AuthForm }) {
  const v = value ?? EMPTY_FORM;
  return (
    <>
      <input
        name="authorizationType"
        defaultValue={v.authorizationType}
        placeholder="Authorization type (e.g. Approved Supervisor)"
        className={field}
        disabled={pending}
      />
      <textarea
        name="detail"
        rows={2}
        defaultValue={v.detail}
        placeholder="Detail (optional)"
        className={area}
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
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        name="adminNotes"
        rows={2}
        defaultValue={v.adminNotes}
        placeholder="Internal admin notes (optional)"
        className={area}
        disabled={pending}
      />
    </>
  );
}

function AuthRow({ memberId, auth }: { memberId: string; auth: any }) {
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
        <EditAuthForm
          auth={auth}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(fields) =>
            run(async () => {
              const res = await upsertAuthorization(memberId, { ...fields, id: auth.id });
              if (res.ok) setEditing(false);
              return res;
            })
          }
        />
        {feedback && !feedback.ok && <p className="mt-2 text-sm text-red-600">{feedback.text}</p>}
      </li>
    );
  }

  const status = auth.status || "active";

  return (
    <li className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{auth.authorization_type || "—"}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone(status)}`}
            >
              {status}
            </span>
          </div>
          {auth.detail && <p className="mt-1 text-sm text-muted">{auth.detail}</p>}
          {(auth.start_date || auth.end_date) && (
            <p className="mt-1 text-xs font-semibold text-muted">
              {fmtDate(auth.start_date)}
              {auth.end_date ? " – " + fmtDate(auth.end_date) : ""}
            </p>
          )}
          {auth.admin_notes && (
            <p className="mt-1 text-xs italic text-muted">Admin note: {auth.admin_notes}</p>
          )}
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
              if (typeof window !== "undefined" && !window.confirm("Delete this authorization?")) return;
              run(() => deleteAuthorization(memberId, auth.id));
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

function EditAuthForm({
  auth,
  pending,
  onCancel,
  onSave,
}: {
  auth: any;
  pending: boolean;
  onCancel: () => void;
  onSave: (fields: AuthForm) => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const value: AuthForm = {
    authorizationType: auth.authorization_type ?? "",
    detail: auth.detail ?? "",
    startDate: auth.start_date ? auth.start_date.slice(0, 10) : "",
    endDate: auth.end_date ? auth.end_date.slice(0, 10) : "",
    status: auth.status ?? "active",
    adminNotes: auth.admin_notes ?? "",
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const f = readForm(e.currentTarget);
    if (!f.authorizationType) {
      setLocalError("Enter an authorization type.");
      return;
    }
    onSave(f);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-ink">Edit authorization</div>
      <AuthFields pending={pending} value={value} />
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
