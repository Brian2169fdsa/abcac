"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  upsertOtherCert,
  deleteOtherCert,
  type OtherCertInput,
} from "@/app/(admin)/admin/members/[id]/records-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

/** Pull the typed certification payload out of an uncontrolled form. */
function readForm(form: HTMLFormElement): OtherCertInput {
  const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
  return {
    credential_title: get("credential_title"),
    credential_number: get("credential_number") || null,
    issuing_board: get("issuing_board"),
    issued_date: get("issued_date") || null,
    expiration_date: get("expiration_date") || null,
  };
}

/** One inline-editable other-certification row plus a delete control. */
function OtherCertEditRow({ memberId, row }: { memberId: string; row: any }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const payload = readForm(e.currentTarget);
    if (!payload.credential_title.trim() || !payload.issuing_board.trim()) {
      setFeedback({ ok: false, text: "Credential title and issuing board are required." });
      return;
    }
    startTransition(async () => {
      const res = await upsertOtherCert(memberId, { ...payload, id: row.id });
      if (res.ok) {
        setFeedback({ ok: true, text: "Saved." });
        router.refresh();
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this certification?")) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteOtherCert(memberId, row.id);
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
            Credential title
          </span>
          <input name="credential_title" defaultValue={row.credential_title ?? ""} className={field} disabled={pending} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Credential number
          </span>
          <input name="credential_number" defaultValue={row.credential_number ?? ""} className={field} disabled={pending} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Issuing board
          </span>
          <input name="issuing_board" defaultValue={row.issuing_board ?? ""} className={field} disabled={pending} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Issued
            </span>
            <input name="issued_date" type="date" defaultValue={row.issued_date ?? ""} className={field} disabled={pending} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Expires
            </span>
            <input name="expiration_date" type="date" defaultValue={row.expiration_date ?? ""} className={field} disabled={pending} />
          </label>
        </div>
      </div>
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

/** Add-a-new-other-certification form. */
function AddOtherCertForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const payload = readForm(form);
    if (!payload.credential_title.trim() || !payload.issuing_board.trim()) {
      setFeedback({ ok: false, text: "Credential title and issuing board are required." });
      return;
    }
    startTransition(async () => {
      const res = await upsertOtherCert(memberId, payload);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Certification added." });
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
      <div className="text-sm font-semibold text-ink">Add certification</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="credential_title" placeholder="Credential title" className={field} disabled={pending} />
        <input name="credential_number" placeholder="Credential number (optional)" className={field} disabled={pending} />
        <input name="issuing_board" placeholder="Issuing board" className={field} disabled={pending} />
        <div className="grid grid-cols-2 gap-3">
          <input name="issued_date" type="date" className={field} disabled={pending} aria-label="Issued date" />
          <input name="expiration_date" type="date" className={field} disabled={pending} aria-label="Expiration date" />
        </div>
      </div>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add certification"}
      </Button>
    </form>
  );
}

/**
 * Admin management of a member's other certifications. Lists each
 * `other_certifications` row as an inline-editable card with delete, plus an
 * add form. All writes go through admin-gated, audited server actions.
 */
export function MemberOtherCertManage({
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
          No certifications recorded yet. Add one below.
        </p>
      ) : (
        rows.map((row) => <OtherCertEditRow key={row.id} memberId={memberId} row={row} />)
      )}
      <AddOtherCertForm memberId={memberId} />
    </div>
  );
}
