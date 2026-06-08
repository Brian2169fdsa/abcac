/**
 * Attention queue — a prioritized list of the oldest / most-urgent pending
 * items pulled from across the admin queues (account approvals, documents,
 * CEU reviews, member requests). Purely presentational: the page does the
 * data fetching and hands over an already-sorted, normalized list.
 */
import Link from "next/link";

export type AttentionItem = {
  /** Stable key for React. */
  id: string;
  /** Short queue label, e.g. "Approval", "Document", "CEU". */
  kind: string;
  /** Who the item belongs to (member name or email). */
  who: string;
  /** What the item is, e.g. document type or course name. */
  what: string;
  /** ISO timestamp the item was submitted / has been waiting since. */
  since: string;
  /** Where the "Review" link points. */
  href: string;
};

const DAY_MS = 86_400_000;
/** Items waiting longer than this (days) are flagged as overdue. */
const OVERDUE_DAYS = 7;

function ageInDays(since: string): number {
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

function ageLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
      {kind}
    </span>
  );
}

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="font-semibold">Needs attention</h2>
        <span className="text-xs text-muted">Oldest pending items first</span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="font-display text-lg font-bold text-brand">All caught up ✓</div>
          <p className="mt-1 text-sm text-muted">No pending items across the review queues.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const days = ageInDays(item.since);
            const overdue = days >= OVERDUE_DAYS;
            return (
              <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                <KindBadge kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{item.who}</div>
                  <div className="truncate text-sm text-muted">{item.what}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={overdue ? "text-sm font-semibold text-red-600" : "text-sm text-muted"}>
                    {ageLabel(days)}
                  </div>
                  {overdue && (
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
                      Overdue
                    </div>
                  )}
                </div>
                <Link
                  href={item.href}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-bg"
                >
                  Review
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
