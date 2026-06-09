"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { WorkflowConfigRow } from "@/app/(admin)/admin/automation/config/page";
import {
  setWorkflowEnabled,
  setWorkflowThresholds,
  setGlobalPause,
} from "@/app/(admin)/admin/automation/config/config-actions";

const field =
  "h-9 w-24 rounded-lg border border-line bg-bg px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50";

/** "" | "0.85" -> null | 0.85. Returns undefined for an unparseable string. */
function parseThreshold(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function fmtThreshold(v: number | null): string {
  return v === null || v === undefined ? "" : String(v);
}

function GlobalPause({
  paused,
  canPause,
}: {
  paused: boolean;
  canPause: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setGlobalPause(!paused);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className={`mb-8 rounded-xl border px-5 py-4 ${
        paused ? "border-red-300 bg-red-50" : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">
            Global pause{" "}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                paused ? "bg-red-600 text-white" : "bg-green-600 text-white"
              }`}
            >
              {paused ? "PAUSED" : "RUNNING"}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {paused
              ? "All automation workflows are stopped engine-wide."
              : "Workflows run subject to their individual kill switches below."}
          </p>
          {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </div>
        {canPause ? (
          <Button
            variant={paused ? "primary" : "outline"}
            onClick={toggle}
            disabled={pending}
          >
            {pending ? "Saving…" : paused ? "Resume engine" : "Pause engine"}
          </Button>
        ) : (
          <span className="text-sm text-muted">Superadmin only</span>
        )}
      </div>
    </div>
  );
}

function WorkflowRow({ row }: { row: WorkflowConfigRow }) {
  const router = useRouter();
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(fmtThreshold(row.auto_threshold));
  const [propose, setPropose] = useState(fmtThreshold(row.propose_threshold));

  const dirty =
    auto !== fmtThreshold(row.auto_threshold) ||
    propose !== fmtThreshold(row.propose_threshold);

  function toggleEnabled() {
    setError(null);
    startToggle(async () => {
      const res = await setWorkflowEnabled(row.workflow, !row.enabled);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function save() {
    setError(null);
    const a = parseThreshold(auto);
    const p = parseThreshold(propose);
    if (a === undefined || p === undefined) {
      setError("Thresholds must be blank or a number between 0 and 1.");
      return;
    }
    if ((a !== null && (a < 0 || a > 1)) || (p !== null && (p < 0 || p > 1))) {
      setError("Thresholds must be between 0 and 1.");
      return;
    }
    startSave(async () => {
      const res = await setWorkflowThresholds(row.workflow, { auto: a, propose: p });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="px-5 py-3 align-top">
          <div className="font-semibold">{row.workflow}</div>
          {row.notes && <div className="mt-0.5 text-xs text-muted">{row.notes}</div>}
        </td>
        <td className="px-5 py-3 align-top">
          <Button
            size="sm"
            variant={row.enabled ? "primary" : "outline"}
            onClick={toggleEnabled}
            disabled={togglePending}
          >
            {togglePending ? "…" : row.enabled ? "On" : "Off"}
          </Button>
        </td>
        <td className="px-5 py-3 align-top">
          <input
            type="number"
            step="0.001"
            min="0"
            max="1"
            value={auto}
            placeholder="—"
            onChange={(e) => setAuto(e.target.value)}
            disabled={savePending}
            className={field}
            aria-label={`${row.workflow} auto threshold`}
          />
        </td>
        <td className="px-5 py-3 align-top">
          <input
            type="number"
            step="0.001"
            min="0"
            max="1"
            value={propose}
            placeholder="—"
            onChange={(e) => setPropose(e.target.value)}
            disabled={savePending}
            className={field}
            aria-label={`${row.workflow} propose threshold`}
          />
        </td>
        <td className="px-5 py-3 align-top">
          <Button size="sm" onClick={save} disabled={savePending || !dirty}>
            {savePending ? "Saving…" : "Save"}
          </Button>
        </td>
      </tr>
      {error && (
        <tr className="border-b border-line last:border-0">
          <td colSpan={5} className="px-5 pb-3 text-sm text-red-700">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

export function AutomationConfigPanel({
  rows,
  paused,
  canPause,
}: {
  rows: WorkflowConfigRow[];
  paused: boolean;
  canPause: boolean;
}) {
  return (
    <div>
      <GlobalPause paused={paused} canPause={canPause} />

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Workflow</th>
              <th className="px-5 py-3">Enabled</th>
              <th className="px-5 py-3">Auto threshold</th>
              <th className="px-5 py-3">Propose threshold</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No automation workflows configured.
                </td>
              </tr>
            ) : (
              rows.map((row) => <WorkflowRow key={row.workflow} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
