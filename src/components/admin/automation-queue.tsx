"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { approveAutomationRun, rejectAutomationRun } from "@/app/(admin)/admin/automation/actions";

export interface PendingRun {
  id: string;
  workflow: string;
  summary: string | null;
  confidence: number | null;
  anomaly_flags: string[] | null;
  member_id: string | null;
  created_at: string | null;
  handler: string | null;
  args: Record<string, unknown> | null;
}

function pct(c: number | null): string {
  return c == null ? "—" : `${Math.round(c * 100)}%`;
}

function PendingCard({ run }: { run: PendingRun }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "approved" | "rejected">(null);

  function act(kind: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res =
        kind === "approved"
          ? await approveAutomationRun(run.id)
          : await rejectAutomationRun(run.id);
      if (res.ok) setDone(kind);
      else setError(res.error);
    });
  }

  const flags = run.anomaly_flags ?? [];

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{run.workflow}</span>
            <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              confidence {pct(run.confidence)}
            </span>
            <span className="text-xs text-muted">{formatDateTime(run.created_at)}</span>
          </div>
          {run.summary ? <p className="mt-1 text-sm text-ink/80">{run.summary}</p> : null}
        </div>
        {run.member_id ? (
          <Link
            href={`/admin/members/${run.member_id}`}
            className="shrink-0 text-sm font-semibold text-brand hover:underline"
          >
            View member
          </Link>
        ) : null}
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

      <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-xs">
        <div className="font-semibold uppercase tracking-wide text-muted">Staged action</div>
        <div className="mt-1 font-mono text-ink/90">{run.handler ?? "— (no handler)"}</div>
        {run.args && Object.keys(run.args).length > 0 ? (
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted">
            {JSON.stringify(run.args, null, 2)}
          </pre>
        ) : null}
      </div>

      {done ? (
        <p className="mt-4 text-sm font-semibold text-brand">
          {done === "approved" ? "Approved and executed." : "Rejected."}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={pending || !run.handler}
            onClick={() => act("approved")}
          >
            {pending ? "Working…" : `Approve & run ${run.handler ?? ""}`.trim()}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act("rejected")}>
            Reject
          </Button>
          {error ? <span className="text-sm font-semibold text-accent">Error: {error}</span> : null}
        </div>
      )}
    </div>
  );
}

export function AutomationQueue({ runs }: { runs: PendingRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
        Nothing needs your attention. The automation engine will surface proposals here when it
        wants a human decision.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {runs.map((r) => (
        <PendingCard key={r.id} run={r} />
      ))}
    </div>
  );
}
