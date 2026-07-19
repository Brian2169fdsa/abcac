/**
 * A single KPI/stat card for the home dashboard — uppercase label, large serif
 * value, and a muted sub-line. Mirrors the static portal's `.stat-card`.
 *
 * Optionally renders a slim progress bar (used by the CEU card).
 */
export function KpiCard({
  label,
  value,
  sub,
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  /** 0–100; when provided, a thin brand progress bar is shown. */
  progress?: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      {typeof progress === "number" && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}
