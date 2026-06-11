// ---------------------------------------------------------------------------
// Automation Audit Explorer — pure, framework-free helpers shared by the page,
// the CSV export route, and the unit tests. Kept OUT of route.ts because Next.js
// route handlers may only export reserved names (GET/POST/runtime/…); a sibling
// module is the standard place for the reusable logic.
//
// Covers: the searchParams→filters parser (with validation + clamping), the
// filters→query-params builder, the automation-scope predicate, the JS-side
// workflow/outcome matching against the `details` jsonb, and the CSV serializer
// + escaping.
// ---------------------------------------------------------------------------

// Workflow keys + labels come from the shared catalog (all 16), so the audit
// filter offers every workflow the engine can run, not a hand-maintained subset.
import { WORKFLOW_CATALOG, workflowLabel as catalogWorkflowLabel } from "@/lib/automation/catalog";

export const WORKFLOWS: string[] = WORKFLOW_CATALOG.map((m) => m.workflow);
export type Workflow = string;

/** Human label for a workflow key (falls back to a humanized key, or em dash). */
export function workflowLabel(wf: string | null | undefined): string {
  if (!wf) return "—";
  return catalogWorkflowLabel(wf);
}

export const ACTOR_TYPES = ["system", "agent", "human"] as const;
export type ActorTypeFilter = (typeof ACTOR_TYPES)[number];

export const DECISION_TIERS = ["auto", "propose", "escalate"] as const;
export type DecisionTier = (typeof DECISION_TIERS)[number];

export const OUTCOMES = ["ok", "error"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface AuditFilters {
  workflow: Workflow | null;
  actorType: ActorTypeFilter | null;
  decisionTier: DecisionTier | null;
  outcome: Outcome | null;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
  action: string | null; // free-text contains
  page: number; // 1-based, clamped >= 1
}

const oneOf = <T extends string>(allowed: readonly T[], v: string | null | undefined): T | null =>
  v != null && (allowed as readonly string[]).includes(v) ? (v as T) : null;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (v: string | null | undefined): string | null =>
  typeof v === "string" && ISO_DATE.test(v) ? v : null;

/** Read one param value whether it's a string, string[], or undefined. */
function pick(v: string | string[] | undefined | null): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  if (typeof v === "string") return v;
  return null;
}

/**
 * Parse + validate + clamp raw searchParams into a typed AuditFilters.
 * Unknown enum values fall back to null ("All"); bad dates are dropped; page is
 * clamped to an integer >= 1; free-text action is trimmed and length-capped.
 */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): AuditFilters {
  const rawAction = pick(sp.action);
  const action = rawAction ? rawAction.trim().slice(0, 200) : null;

  const rawPage = pick(sp.page);
  let page = rawPage ? Number.parseInt(rawPage, 10) : 1;
  if (!Number.isFinite(page) || page < 1) page = 1;

  return {
    workflow: oneOf(WORKFLOWS, pick(sp.workflow)),
    actorType: oneOf(ACTOR_TYPES, pick(sp.actor_type)),
    decisionTier: oneOf(DECISION_TIERS, pick(sp.decision_tier)),
    outcome: oneOf(OUTCOMES, pick(sp.outcome)),
    from: isoDate(pick(sp.from)),
    to: isoDate(pick(sp.to)),
    action: action || null,
    page,
  };
}

/**
 * Serialize the active filters back into a flat query-param record (omitting
 * "All"/empty values). Used to carry the SAME filters from the page to the
 * Export CSV link and to build prev/next pagination links.
 */
export function filtersToParams(
  f: AuditFilters,
  opts: { includePage?: boolean } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.workflow) out.workflow = f.workflow;
  if (f.actorType) out.actor_type = f.actorType;
  if (f.decisionTier) out.decision_tier = f.decisionTier;
  if (f.outcome) out.outcome = f.outcome;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.action) out.action = f.action;
  if (opts.includePage && f.page > 1) out.page = String(f.page);
  return out;
}

// ── Automation scope ───────────────────────────────────────────────────────

/**
 * Automation-scoped predicate: a row belongs to the explorer when it is tied to
 * an automation run OR its actor is non-human (system/agent). Mirrors the SQL
 * base filter and is applied defensively in JS as well.
 */
export function isAutomationScoped(row: {
  automation_run_id?: unknown;
  actor_type?: unknown;
}): boolean {
  if (row.automation_run_id != null) return true;
  return row.actor_type === "system" || row.actor_type === "agent";
}

// ── Outcome / workflow extraction from details jsonb ───────────────────────

export type DetailsLike = Record<string, unknown> | null | undefined;

/** ok | error | null — derived from details->>ok (and an `error` presence). */
export function rowOutcome(details: DetailsLike): Outcome | null {
  if (!details || typeof details !== "object") return null;
  const ok = (details as Record<string, unknown>).ok;
  if (ok === true) return "ok";
  if (ok === false) return "error";
  // Some rows only carry an `error` string without an explicit ok flag.
  if (typeof (details as Record<string, unknown>).error === "string") return "error";
  return null;
}

/** The workflow key stored in details->>workflow (or null). */
export function rowWorkflow(details: DetailsLike): string | null {
  if (!details || typeof details !== "object") return null;
  const wf = (details as Record<string, unknown>).workflow;
  return typeof wf === "string" && wf ? wf : null;
}

export function rowError(details: DetailsLike): string | null {
  if (!details || typeof details !== "object") return null;
  const err = (details as Record<string, unknown>).error;
  return typeof err === "string" && err ? err : null;
}

/**
 * JS-side predicate for the workflow + outcome filters. We filter these in JS
 * rather than via a Postgres JSON-path operator: the workflow/outcome live
 * inside the `details` jsonb (details->>workflow / details->>ok) and applying
 * them in JS keeps behavior identical between the page and the export, and
 * avoids brittle `.eq("details->>workflow", ...)` operator-string handling.
 */
export function matchesJsFilters(
  row: { details?: DetailsLike },
  f: Pick<AuditFilters, "workflow" | "outcome">,
): boolean {
  if (f.workflow && rowWorkflow(row.details) !== f.workflow) return false;
  if (f.outcome && rowOutcome(row.details) !== f.outcome) return false;
  return true;
}

// ── CSV serialization ──────────────────────────────────────────────────────

/** RFC-4180-style field escape with spreadsheet formula-injection guard. */
export function escapeCsv(val: unknown): string {
  let s = val == null ? "" : String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(rows: (string | null | undefined)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export const CSV_HEADER = [
  "created_at",
  "actor_type",
  "admin_name",
  "action",
  "workflow",
  "decision_tier",
  "ok",
  "error",
  "target_table",
  "target_id",
  "automation_run_id",
] as const;

interface ProfileLike {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ExportRow {
  created_at?: string | null;
  actor_type?: string | null;
  admin_id?: string | null;
  action?: string | null;
  details?: DetailsLike;
  decision_tier?: string | null;
  target_table?: string | null;
  target_id?: string | null;
  automation_run_id?: string | null;
  profiles?: ProfileLike | ProfileLike[] | null;
}

function adminName(profiles: ExportRow["profiles"], actorType: string | null | undefined): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  if (p) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
    if (name) return name;
    if (p.email) return p.email;
  }
  // No human actor → label by actor_type.
  if (actorType === "system" || actorType === "agent") return actorType;
  return "";
}

/** Map one audit row to its CSV cells, in CSV_HEADER order. */
export function serializeRow(row: ExportRow): string[] {
  const outcome = rowOutcome(row.details);
  return [
    row.created_at ?? "",
    row.actor_type ?? "",
    adminName(row.profiles, row.actor_type),
    row.action ?? "",
    rowWorkflow(row.details) ?? "",
    row.decision_tier ?? "",
    outcome === "ok" ? "true" : outcome === "error" ? "false" : "",
    rowError(row.details) ?? "",
    row.target_table ?? "",
    row.target_id ?? "",
    row.automation_run_id ?? "",
  ];
}

/** Build the full CSV string (header + body) for a set of rows. */
export function buildCsv(rows: ExportRow[]): string {
  return toCsv([[...CSV_HEADER], ...rows.map(serializeRow)]);
}

export const EXPORT_ROW_CAP = 5000;

/**
 * Apply the scalar (non-jsonb) filters that map cleanly onto Supabase query
 * builder methods. Returns the same builder for chaining. The workflow + outcome
 * filters are NOT applied here (they live in the jsonb `details` and are matched
 * in JS via matchesJsFilters).
 */
export function applyScalarFilters<
  T extends {
    eq: (c: string, v: unknown) => T;
    ilike: (c: string, v: string) => T;
    gte: (c: string, v: string) => T;
    lte: (c: string, v: string) => T;
  },
>(query: T, f: AuditFilters): T {
  let q = query;
  if (f.actorType) q = q.eq("actor_type", f.actorType);
  if (f.decisionTier) q = q.eq("decision_tier", f.decisionTier);
  if (f.action) q = q.ilike("action", `%${f.action}%`);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00.000Z`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59.999Z`);
  return q;
}

/** The Supabase `.or()` expression for the automation base scope. */
export const AUTOMATION_SCOPE_OR = "automation_run_id.not.is.null,actor_type.in.(system,agent)";
