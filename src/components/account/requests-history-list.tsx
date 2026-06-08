import type { ReactNode } from "react";

/**
 * Compact, brand-matched history list for previously submitted member requests
 * (name change, verification, reciprocity). Each row shows a label, a status
 * pill, the submitted date, and an optional trailing action (e.g. View ID).
 */
const TONES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  denied: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-800",
};

function statusTone(status: string | null | undefined) {
  const key = (status ?? "pending").toLowerCase();
  return TONES[key] ?? "bg-line text-muted";
}

export interface RequestHistoryRow {
  id: string;
  label: ReactNode;
  status: string | null;
  submittedAt: string | null;
  trailing?: ReactNode;
}

function fmt(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

export function RequestsHistoryList({
  title,
  rows,
  emptyLabel = "No prior requests yet.",
}: {
  title?: string;
  rows: RequestHistoryRow[];
  emptyLabel?: string;
}) {
  return (
    <div className="mt-4">
      {title && (
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-3 text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 text-ink">{r.label}</span>
              <span className="flex items-center gap-3 text-muted">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusTone(
                    r.status,
                  )}`}
                >
                  {r.status ?? "pending"}
                </span>
                <span className="whitespace-nowrap text-xs">{fmt(r.submittedAt)}</span>
                {r.trailing}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
