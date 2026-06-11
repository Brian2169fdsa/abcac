import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimeWithYear } from "@/lib/format";
import { StatusBadge, TierBadge } from "../../status-badge";

export const dynamic = "force-dynamic";

// Read-only detail view for one automation run: every recorded field, the
// staged action JSON, and the linked admin_audit_log entries (with their
// payload_before / payload_after snapshots) for full defensibility.

interface StagedAction {
  handler?: string;
  args?: Record<string, unknown>;
}

interface RunRow {
  id: string;
  created_at: string | null;
  workflow: string;
  entity_type: string | null;
  entity_id: string | null;
  member_id: string | null;
  tier: string | null;
  confidence: number | null;
  rule_version: string | null;
  model_version: string | null;
  staged_action: StagedAction | null;
  anomaly_flags: string[] | null;
  summary: string | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface AuditRow {
  id: string;
  created_at: string | null;
  action: string | null;
  actor_type: string | null;
  decision_tier: string | null;
  confidence: number | null;
  rule_version: string | null;
  model_version: string | null;
  details: Record<string, unknown> | null;
  payload_before: Record<string, unknown> | null;
  payload_after: Record<string, unknown> | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-bg p-3 font-mono text-[11px] text-ink/90">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function AutomationRunDetail({ params }: { params: { id: string } }) {
  const sb = createSupabaseServerClient();

  const [{ data: runData }, { data: auditData }] = await Promise.all([
    sb.from("automation_runs").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("admin_audit_log")
      .select(
        "id,created_at,action,actor_type,decision_tier,confidence,rule_version,model_version,details,payload_before,payload_after",
      )
      .eq("automation_run_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  const run = runData as RunRow | null;
  if (!run) notFound();

  const audits = (auditData as AuditRow[] | null) ?? [];
  const flags = run.anomaly_flags ?? [];

  return (
    <>
      <Link href="/admin/automation" className="text-sm font-semibold text-brand hover:underline">
        ← Back to automation
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Run: {run.workflow}</h1>
        <StatusBadge status={run.status} />
        <TierBadge tier={run.tier} />
      </div>
      <p className="mb-6 mt-1 font-mono text-xs text-muted">{run.id}</p>

      <div className="rounded-xl border border-line bg-surface p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <Field label="Created">{formatDateTimeWithYear(run.created_at)}</Field>
          <Field label="Entity">
            {run.entity_type ?? "—"}
            {run.entity_id ? (
              <span className="ml-1 font-mono text-xs text-muted">{run.entity_id}</span>
            ) : null}
          </Field>
          <Field label="Member">
            {run.member_id ? (
              <Link
                href={`/admin/members/${run.member_id}`}
                className="font-semibold text-brand hover:underline"
              >
                View member
              </Link>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Confidence">
            {run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "—"}
          </Field>
          <Field label="Rule version">
            <span className="font-mono text-xs">{run.rule_version ?? "—"}</span>
          </Field>
          <Field label="Model version">
            <span className="font-mono text-xs">{run.model_version ?? "—"}</span>
          </Field>
          <Field label="Resolved">{formatDateTimeWithYear(run.resolved_at)}</Field>
          <Field label="Resolved by">
            {run.resolved_by ? (
              <Link
                href={`/admin/members/${run.resolved_by}`}
                className="font-semibold text-brand hover:underline"
              >
                View profile
              </Link>
            ) : (
              "—"
            )}
          </Field>
        </dl>
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">Summary</h2>
      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink/90">
        {run.summary ?? <span className="text-muted">No summary recorded.</span>}
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">Anomaly flags</h2>
      {flags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f}
              className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent"
            >
              {f}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">None.</p>
      )}

      <h2 className="mb-2 mt-8 text-lg font-bold">Staged action</h2>
      {run.staged_action ? (
        <JsonBlock value={run.staged_action} />
      ) : (
        <p className="text-sm text-muted">No staged action — nothing was (or would be) executed.</p>
      )}

      <h2 className="mb-2 mt-8 text-lg font-bold">Audit trail</h2>
      {audits.length === 0 ? (
        <p className="text-sm text-muted">
          No audit entries linked to this run (nothing has executed).
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {audits.map((a) => (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{a.action ?? "—"}</span>
                <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
                  actor: {a.actor_type ?? "—"}
                </span>
                {a.decision_tier ? (
                  <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
                    tier: {a.decision_tier}
                  </span>
                ) : null}
                <span className="text-xs text-muted">{formatDateTimeWithYear(a.created_at)}</span>
              </div>
              {a.details ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Details
                  </div>
                  <JsonBlock value={a.details} />
                </div>
              ) : null}
              {a.payload_before || a.payload_after ? (
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Payload before
                    </div>
                    {a.payload_before ? (
                      <JsonBlock value={a.payload_before} />
                    ) : (
                      <p className="mt-1 text-sm text-muted">—</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Payload after
                    </div>
                    {a.payload_after ? (
                      <JsonBlock value={a.payload_after} />
                    ) : (
                      <p className="mt-1 text-sm text-muted">—</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
