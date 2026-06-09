"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setApplicationReview } from "@/app/(admin)/admin/members/[id]/billing-actions";

const field =
  "h-9 w-full rounded-lg border border-line bg-bg px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const area =
  "w-full rounded-lg border border-line bg-bg p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

/** YYYY-MM-DD for a <input type="date"> from a stored date/timestamp string. */
function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

/**
 * Admin application review fields (parity gap B7). Per application, an admin can
 * edit `admin_notes` and `est_completion` (the ETA the member sees) —
 * complementing app-status-control.tsx, which only sets the status. Writes go
 * through a server action that re-checks admin rights server-side.
 */
export function MemberApplicationReview({
  memberId,
  applications,
}: {
  memberId: string;
  applications: any[];
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Application review</h3>
        <span className="text-xs text-muted">{applications.length} total</span>
      </div>
      {applications.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-muted">
          No applications for this member yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {applications.map((app) => (
            <ApplicationRow key={app.id} memberId={memberId} application={app} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationRow({ memberId, application }: { memberId: string; application: any }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [notes, setNotes] = useState(application.admin_notes ?? "");
  const [est, setEst] = useState(toDateInput(application.est_completion));

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await setApplicationReview(memberId, String(application.id), {
        admin_notes: notes,
        est_completion: est,
      });
      setFeedback(res.ok ? { ok: true, text: "Review saved." } : { ok: false, text: "Failed: " + res.error });
    });
  }

  return (
    <li className="py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-ink">
          {(application.app_type ?? "Application").replace(/_/g, " ")}
          {application.cert_type ? <span className="text-muted"> · {application.cert_type}</span> : null}
        </div>
        <span className="text-xs capitalize text-muted">{(application.status ?? "—").replace(/_/g, " ")}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Admin notes</span>
          <textarea
            className={area}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
            placeholder="Internal review notes"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Est. completion (member-visible)</span>
          <input
            className={field}
            type="date"
            value={est}
            onChange={(e) => setEst(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save review"}
        </Button>
        {feedback && (
          <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
        )}
      </div>
    </li>
  );
}
