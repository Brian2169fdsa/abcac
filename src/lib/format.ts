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

/** Whole-dollar amount → "$1,234" (en-US grouping, rounded; non-finite → "$0"). */
export function formatUsd(amount: number): string {
  return `$${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US")}`;
}

/** 0..1 ratio → "85%" (rounded whole percent). */
export function formatPercent(ratio: number): string {
  return `${Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)}%`;
}

/**
 * Compact number: 1234 → "1.2K", 25000 → "25K", 1_500_000 → "1.5M";
 * below 1000 falls back to en-US grouping. Lives here (not in the
 * "use client" charts kit) so SERVER components can call it directly —
 * importing a plain function across a "use client" boundary yields a
 * client-reference proxy that throws "is not a function" when invoked
 * during server render.
 */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}K`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

/** Compact money with a leading $. */
export function formatMoneyCompact(n: number): string {
  return `$${formatCompact(n)}`;
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
