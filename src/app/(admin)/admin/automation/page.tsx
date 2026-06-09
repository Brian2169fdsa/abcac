import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AutomationQueue, type PendingRun } from "@/components/admin/automation-queue";

export const dynamic = "force-dynamic";

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
  staged_action: StagedAction | null;
  anomaly_flags: string[] | null;
  summary: string | null;
  status: string;
  resolved_at: string | null;
}

const ACTIVITY_STATUSES = ["auto_executed", "escalated", "failed", "approved", "rejected"];

function fmt(d: string | null): string {
  return d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

const STATUS_LABEL: Record<string, string> = {
  auto_executed: "Auto-executed",
  escalated: "Escalated",
  failed: "Failed",
  approved: "Approved",
  rejected: "Rejected",
  pending_approval: "Pending",
};

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "failed" || status === "escalated"
      ? "bg-accent/10 text-accent"
      : status === "rejected"
        ? "bg-bg text-muted"
        : "bg-brand/10 text-brand";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default async function AdminAutomation() {
  const sb = createSupabaseServerClient();

  const [{ data: pendingData }, { data: activityData }] = await Promise.all([
    sb
      .from("automation_runs")
      .select("*")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false }),
    sb
      .from("automation_runs")
      .select("*")
      .in("status", ACTIVITY_STATUSES)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const pendingRows = (pendingData as RunRow[]) ?? [];
  const activityRows = (activityData as RunRow[]) ?? [];

  const pending: PendingRun[] = pendingRows.map((r) => ({
    id: r.id,
    workflow: r.workflow,
    summary: r.summary,
    confidence: r.confidence,
    anomaly_flags: r.anomaly_flags,
    member_id: r.member_id,
    created_at: r.created_at,
    handler: r.staged_action?.handler ?? null,
    args: r.staged_action?.args ?? null,
  }));

  return (
    <>
      <h1 className="text-2xl font-bold">Automation</h1>
      <p className="mb-6 text-muted">
        Decisions the automation engine staged for a human, plus a feed of what it has done on its
        own.
      </p>

      <h2 className="mb-1 text-xl font-bold">Needs attention</h2>
      <p className="mb-4 text-muted">
        Proposals the engine wants you to approve before it runs the staged action.
      </p>
      <div className="mb-10">
        <AutomationQueue runs={pending} />
      </div>

      <h2 className="mb-2 text-xl font-bold">Recent activity</h2>
      <p className="mb-4 text-muted">The last {ACTIVITY_STATUSES.length ? 50 : 0} engine outcomes.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Workflow</th>
              <th className="px-5 py-3">Summary</th>
              <th className="px-5 py-3">Handler</th>
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {activityRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  No automation activity yet.
                </td>
              </tr>
            ) : (
              activityRows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-5 py-3 text-muted">{fmt(r.created_at)}</td>
                  <td className="px-5 py-3 font-semibold">{r.workflow}</td>
                  <td className="px-5 py-3 text-muted">{r.summary ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">
                    {r.staged_action?.handler ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {r.member_id ? (
                      <Link
                        href={`/admin/members/${r.member_id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
