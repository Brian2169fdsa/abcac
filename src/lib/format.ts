// ABCAC — shared display formatting helpers.

/** "Jan 5, 3:42 PM" style timestamp, or an em dash when missing. */
export function formatDateTime(d: string | null): string {
  return d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

/** "Jan 5, 2026, 3:42 PM" style timestamp (with year), or an em dash when missing. */
export function formatDateTimeWithYear(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Cents → "$1,234.5"-style dollar string (en-US grouping, no forced decimals). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

/** Whole-dollar amount → "$1,234" (en-US grouping, rounded). */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** 0..1 ratio → "85%" (rounded whole percent). */
export function formatPercent(ratio: number): string {
  return `${Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)}%`;
}

/** Minutes → compact human duration: "0m", "45m", "3h 20m", "2d 4h". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (hours < 24) return rem ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}
