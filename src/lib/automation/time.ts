// ABCAC — tiny shared day-math helpers for the automation lib.

/** One day in milliseconds. */
export const DAY_MS = 86_400_000;

/** YYYY-MM-DD slice of a Date (UTC), matching Postgres `date` columns. */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
