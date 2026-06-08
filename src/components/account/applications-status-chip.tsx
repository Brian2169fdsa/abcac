/**
 * Status pill for application records. Maps the application lifecycle status
 * (submitted / under_review / approved / rejected) onto brand-token tones so
 * members can scan state at a glance. Prefixed to avoid collisions with the
 * shared StatusChip.
 */
const TONES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  under_review: "bg-amber-100 text-amber-800",
  submitted: "bg-info/10 text-info",
  rejected: "bg-red-100 text-red-700",
  denied: "bg-red-100 text-red-700",
};

function label(status: string | null) {
  return (status ?? "submitted").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ApplicationsStatusChip({ status }: { status: string | null }) {
  const key = (status ?? "submitted").toLowerCase();
  const tone = TONES[key] ?? "bg-line text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label(status)}
    </span>
  );
}
