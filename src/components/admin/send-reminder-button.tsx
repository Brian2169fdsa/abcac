"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { runMemberReminders } from "@/app/(admin)/admin/members/[id]/reminder-actions";

/**
 * "Run reminders now" — triggers the reminder engine for this member on demand.
 * Only delivers what's actually due (and is deduped), so it's safe to click. The
 * daily cron does the same automatically; this is for sending immediately.
 */
export function SendReminderButton({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [, setBusy] = useState(false);

  function run() {
    setMsg(null);
    setBusy(true);
    startTransition(async () => {
      const res = await runMemberReminders(memberId);
      setBusy(false);
      if (res.ok) {
        setIsError(false);
        setMsg(
          res.remindersSent === 0
            ? "Nothing due right now — no reminders sent."
            : `Sent ${res.remindersSent} reminder${res.remindersSent === 1 ? "" : "s"}${res.emailsSent ? ` (${res.emailsSent} email${res.emailsSent === 1 ? "" : "s"})` : ""}.`,
        );
      } else {
        setIsError(true);
        setMsg(`Couldn't run reminders: ${res.error}`);
      }
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">Reminders</div>
          <p className="mt-0.5 text-xs text-muted">
            Send any due renewal, CEU, document, or task reminders to this member now (email + portal).
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {pending ? "Running…" : "Run reminders now"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${isError ? "text-brand" : "text-success"}`}>{msg}</p>
      )}
    </div>
  );
}
