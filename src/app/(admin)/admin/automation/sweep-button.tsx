"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runSweepNow } from "./actions";

// Manual trigger for the cron sweep. Calls the admin-gated runSweepNow server
// action and renders its per-workflow scanned/dispatched/skipped summary inline.

interface WorkflowSweepOutcome {
  scanned?: number;
  dispatched?: number;
  skipped?: string;
  error?: string;
}

function outcomeLabel(v: unknown): string {
  if (!v || typeof v !== "object") return String(v ?? "—");
  const o = v as WorkflowSweepOutcome;
  if (o.skipped) return `skipped (${o.skipped})`;
  if (o.error) return `error: ${o.error}`;
  return `scanned ${o.scanned ?? 0}, dispatched ${o.dispatched ?? 0}`;
}

export function SweepButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await runSweepNow();
      if (res.ok) setResult(res.result);
      else setError(res.error);
    });
  }

  const entries = result ? Object.entries(result) : [];
  const paused = Boolean(result && (result as { paused?: boolean }).paused);

  return (
    <div>
      <Button size="sm" variant="outline" disabled={pending} onClick={run}>
        {pending ? "Sweeping…" : "Run sweep now"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-accent">Sweep failed: {error}</p>
      ) : null}
      {result ? (
        <div className="mt-2 rounded-lg border border-line bg-bg p-3 text-xs">
          <div className="font-semibold uppercase tracking-wide text-muted">Sweep result</div>
          {paused ? (
            <p className="mt-1 font-semibold text-accent">
              Automation is globally paused — nothing was scanned.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {entries.map(([workflow, v]) => (
                <li key={workflow}>
                  <span className="font-mono font-semibold text-ink/90">{workflow}</span>{" "}
                  <span className="text-muted">{outcomeLabel(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
