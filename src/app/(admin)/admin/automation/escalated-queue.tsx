"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { resolveEscalatedRun } from "./actions";

// Escalated runs the engine refused to act on. There is nothing to "approve" —
// the admin handles the underlying record manually (member link / detail view)
// and then dismisses the escalation, which marks the run rejected.

export interface EscalatedRun {
  id: string;
  workflow: string;
  summary: string | null;
  anomaly_flags: string[] | null;
  member_id: string | null;
  created_at: string | null;
}

function EscalatedCard({ run }: { run: EscalatedRun }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function dismiss() {
    setError(null);
    startTransition(async () => {
      const res = await resolveEscalatedRun(run.id);
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  const flags = run.anomaly_flags ?? [];

  return (
    <div className="rounded-xl border border-accent/30 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{run.workflow}</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              escalated
            </span>
            <span className="text-xs text-muted">{formatDateTime(run.created_at)}</span>
          </div>
          {run.summary ? <p className="mt-1 text-sm text-ink/80">{run.summary}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {run.member_id ? (
            <Link
              href={`/admin/members/${run.member_id}`}
              className="text-sm font-semibold text-brand hover:underline"
            >
              View member
            </Link>
          ) : null}
          <Link
            href={`/admin/automation/runs/${run.id}`}
            className="text-sm font-semibold text-brand hover:underline"
          >
            Details
          </Link>
        </div>
      </div>

      {flags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f}
              className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent"
            >
              {f}
            </span>
          ))}
        </div>
      ) : null}

      {done ? (
        <p className="mt-4 text-sm font-semibold text-brand">Dismissed.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={dismiss}>
            {pending ? "Working…" : "Dismiss escalation"}
          </Button>
          {error ? <span className="text-sm font-semibold text-accent">Error: {error}</span> : null}
        </div>
      )}
    </div>
  );
}

export function EscalatedQueue({ runs }: { runs: EscalatedRun[] }) {
  if (runs.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {runs.map((r) => (
        <EscalatedCard key={r.id} run={r} />
      ))}
    </div>
  );
}
