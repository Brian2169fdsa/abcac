"use client";

// Plain GET <form> that drives the Automation Audit Explorer's filters via the
// URL searchParams. No client state library — the form's named fields ARE the
// state; submitting navigates to the same page with the chosen query string.
// Current values come in as props (read from searchParams on the server) so the
// controls stay populated across navigations.

import Link from "next/link";
import { WORKFLOW_CATALOG, workflowLabel } from "@/lib/automation/catalog";

// Structural mirror of the route's AuditFilters (the GET form only needs the
// current display values). Kept local so this client component imports nothing
// from the route module.
interface AuditFilters {
  workflow: string | null;
  actorType: string | null;
  decisionTier: string | null;
  outcome: string | null;
  from: string | null;
  to: string | null;
  action: string | null;
  page: number;
}

// Workflow keys/labels come from the shared catalog (all 16). The remaining
// option lists are display-only mirrors kept local so this client component
// never imports the route module (which pulls the server-only supabase client).
const WORKFLOWS = WORKFLOW_CATALOG.map((m) => m.workflow);
const ACTOR_TYPES = ["system", "agent", "human"] as const;
const DECISION_TIERS = ["auto", "propose", "escalate"] as const;
const OUTCOMES = ["ok", "error"] as const;

const TIER_LABELS: Record<string, string> = {
  auto: "Auto",
  propose: "Propose",
  escalate: "Escalate",
};

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted";
const fieldClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-brand focus:outline-none";

export function AuditFilters({
  filters,
  exportHref,
}: {
  filters: AuditFilters;
  exportHref: string;
}) {
  return (
    <form
      method="get"
      className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label className={labelClass} htmlFor="f-workflow">
          Workflow
        </label>
        <select
          id="f-workflow"
          name="workflow"
          defaultValue={filters.workflow ?? ""}
          className={fieldClass}
        >
          <option value="">All</option>
          {WORKFLOWS.map((wf) => (
            <option key={wf} value={wf}>
              {workflowLabel(wf)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-actor">
          Actor
        </label>
        <select
          id="f-actor"
          name="actor_type"
          defaultValue={filters.actorType ?? ""}
          className={fieldClass}
        >
          <option value="">All</option>
          {ACTOR_TYPES.map((a) => (
            <option key={a} value={a}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-tier">
          Decision tier
        </label>
        <select
          id="f-tier"
          name="decision_tier"
          defaultValue={filters.decisionTier ?? ""}
          className={fieldClass}
        >
          <option value="">All</option>
          {DECISION_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-outcome">
          Outcome
        </label>
        <select
          id="f-outcome"
          name="outcome"
          defaultValue={filters.outcome ?? ""}
          className={fieldClass}
        >
          <option value="">All</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o === "ok" ? "OK" : "Error"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="f-from">
          From
        </label>
        <input
          id="f-from"
          type="date"
          name="from"
          defaultValue={filters.from ?? ""}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="f-to">
          To
        </label>
        <input
          id="f-to"
          type="date"
          name="to"
          defaultValue={filters.to ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="f-action">
          Action contains
        </label>
        <input
          id="f-action"
          type="text"
          name="action"
          defaultValue={filters.action ?? ""}
          placeholder="e.g. mark_invoice_paid"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Apply filters
        </button>
        <Link
          href="/admin/automation/audit"
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-bg"
        >
          Reset
        </Link>
        <a
          href={exportHref}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-brand hover:bg-bg"
        >
          Export CSV
        </a>
      </div>
    </form>
  );
}
