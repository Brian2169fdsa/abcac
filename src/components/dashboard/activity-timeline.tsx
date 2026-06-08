/**
 * Recent-activity timeline for the home dashboard — a vertical rail of dated
 * events derived from the member's real records (CEU submissions, applications,
 * payments). Mirrors the static portal's `.timeline`.
 */
export type ActivityStatus = "done" | "current" | "default";

export interface ActivityEvent {
  title: string;
  /** ISO date string (or null). */
  date: string | null;
  status: ActivityStatus;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const DOT_CLASS: Record<ActivityStatus, string> = {
  done: "border-success bg-success",
  current: "border-info bg-info",
  default: "border-accent bg-surface",
};

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h3 className="text-base">No recent activity</h3>
        <p className="mt-1 text-sm text-muted">
          Your activity will appear here as you log CEUs, apply, and renew.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <ol className="relative ml-2 border-l-2 border-line">
        {events.map((e, i) => (
          <li key={`${e.title}-${i}`} className="relative pl-6 pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[8px] top-1 h-3.5 w-3.5 rounded-full border-[3px] ${DOT_CLASS[e.status]}`}
            />
            <div className="text-sm font-semibold text-ink">{e.title}</div>
            <div className="mt-0.5 text-xs text-muted">{fmtDate(e.date)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
