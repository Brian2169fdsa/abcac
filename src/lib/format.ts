// ABCAC — shared display formatting helpers.

/** "Jan 5, 3:42 PM" style timestamp, or an em dash when missing. */
export function formatDateTime(d: string | null): string {
  return d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

/** Cents → "$1,234.5"-style dollar string (en-US grouping, no forced decimals). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}
