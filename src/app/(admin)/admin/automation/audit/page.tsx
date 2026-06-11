import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuditFilters } from "./audit-filters";
import { AutomationTabs } from "../automation-tabs";
import { formatDateTimeWithYear } from "@/lib/format";
import {
  parseFilters,
  filtersToParams,
  isAutomationScoped,
  matchesJsFilters,
  applyScalarFilters,
  rowOutcome,
  rowWorkflow,
  rowError,
  workflowLabel,
  AUTOMATION_SCOPE_OR,
  type AuditFilters as AuditFiltersType,
  type ExportRow,
} from "@/app/api/admin/automation/audit/audit-shared";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface AuditProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AuditRow extends ExportRow {
  id: string;
  created_at: string | null;
  actor_type: string | null;
  admin_id: string | null;
  action: string | null;
  details: Record<string, unknown> | null;
  decision_tier: string | null;
  target_table: string | null;
  target_id: string | null;
  automation_run_id: string | null;
  profiles: AuditProfile | AuditProfile[] | null;
}

function getProfile(profiles: AuditRow["profiles"]): AuditProfile | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

function actorLabel(row: AuditRow): string {
  const p = getProfile(row.profiles);
  if (row.admin_id && p) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return name || p.email || "Admin";
  }
  if (row.actor_type === "system") return "System";
  if (row.actor_type === "agent") return "Agent";
  return row.actor_type ?? "—";
}

function targetLabel(row: AuditRow): string {
  if (!row.target_table) return "—";
  const id = row.target_id ? `:${String(row.target_id).slice(0, 8)}` : "";
  return `${row.target_table}${id}`;
}

function toSearch(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `?${q}` : "";
}

function pageHref(filters: AuditFiltersType, page: number): string {
  const params = filtersToParams({ ...filters, page }, { includePage: true });
  return `/admin/automation/audit${toSearch(params)}`;
}

const tierTone: Record<string, string> = {
  auto: "bg-brand/10 text-brand",
  propose: "bg-amber-100 text-amber-700",
  escalate: "bg-accent/10 text-accent",
};

export default async function AutomationAuditPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);

  const sb = createSupabaseServerClient();

  // Automation base scope: tied to a run OR a non-human actor.
  const query = applyScalarFilters(
    sb
      .from("admin_audit_log")
      .select("*, profiles(first_name,last_name,email)")
      .or(AUTOMATION_SCOPE_OR)
      .order("created_at", { ascending: false })
      .limit(2000),
    filters,
  );

  const { data, error } = await query;

  // workflow + outcome live inside details jsonb → matched in JS (see route).
  const matched = ((data as AuditRow[] | null) ?? [])
    .filter(isAutomationScoped)
    .filter((r) => matchesJsFilters(r, filters));

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const rows = matched.slice(start, start + PAGE_SIZE);

  const exportHref = `/api/admin/automation/audit/export${toSearch(filtersToParams(filters))}`;

  return (
    <>
      <AutomationTabs />

      <h1 className="text-2xl font-bold">Automation Audit</h1>
      <p className="mb-6 text-muted">
        Every action taken by the automation engine — auto-executed decisions, approved proposals,
        and escalations. Filter, then export to CSV.
      </p>

      <AuditFilters filters={filters} exportHref={exportHref} />

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading audit log: {error.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Run</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No automation audit entries match these filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const outcome = rowOutcome(row.details);
                const err = rowError(row.details);
                return (
                  <tr key={row.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTimeWithYear(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{actorLabel(row)}</span>
                      <div className="text-xs text-muted">{row.actor_type ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.action ?? "—"}</td>
                    <td className="px-4 py-3">{workflowLabel(rowWorkflow(row.details))}</td>
                    <td className="px-4 py-3">
                      {row.decision_tier ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            tierTone[row.decision_tier] ?? "bg-bg text-muted"
                          }`}
                        >
                          {row.decision_tier}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {outcome === "ok" ? (
                        <span className="font-semibold text-green-600" title="ok">
                          ✓
                        </span>
                      ) : outcome === "error" ? (
                        <span className="text-accent" title={err ?? "error"}>
                          ✗ {err ? <span className="text-xs text-muted">{err}</span> : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{targetLabel(row)}</td>
                    <td className="px-4 py-3">
                      {row.automation_run_id ? (
                        <Link
                          href={`/admin/automation/runs/${row.automation_run_id}`}
                          className="font-semibold text-brand hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {total === 0
            ? "0 results"
            : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(filters, page - 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-bg"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded-lg border border-line px-3 py-1.5 opacity-40">← Prev</span>
          )}
          <span className="px-2 py-1.5">
            Page {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(filters, page + 1)}
              className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-bg"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-lg border border-line px-3 py-1.5 opacity-40">Next →</span>
          )}
        </div>
      </div>
    </>
  );
}
