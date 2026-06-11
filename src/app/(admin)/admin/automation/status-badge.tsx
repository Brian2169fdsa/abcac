// Shared, server-renderable badges for the automation console (list + detail).

export const RUN_STATUSES = [
  "auto_executed",
  "pending_approval",
  "approving",
  "approved",
  "rejected",
  "escalated",
  "failed",
] as const;

const STATUS_LABEL: Record<string, string> = {
  auto_executed: "Auto-executed",
  pending_approval: "Pending approval",
  approving: "Approving…",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  failed: "Failed",
};

const STATUS_TONE: Record<string, string> = {
  auto_executed: "bg-emerald-100 text-emerald-800",
  pending_approval: "bg-amber-100 text-amber-800",
  approving: "bg-amber-100 text-amber-800",
  approved: "bg-brand/10 text-brand",
  rejected: "bg-bg text-muted",
  escalated: "bg-accent/10 text-accent",
  failed: "bg-red-100 text-red-700",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "bg-bg text-muted";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {statusLabel(status)}
    </span>
  );
}

const TIER_TONE: Record<string, string> = {
  auto: "bg-emerald-100 text-emerald-800",
  propose: "bg-amber-100 text-amber-800",
  escalate: "bg-accent/10 text-accent",
};

export function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-muted">—</span>;
  const tone = TIER_TONE[tier] ?? "bg-bg text-muted";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {tier}
    </span>
  );
}
