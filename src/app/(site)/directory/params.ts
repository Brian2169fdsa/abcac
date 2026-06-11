// Pure helpers for the public /directory page — searchParams parsing/clamping,
// pagination math, and result-range formatting. Kept free of React/Next and the
// Supabase client so they can be unit-tested in isolation.

import { CREDENTIAL_TYPES } from "@/lib/directory";

export const PAGE_SIZE = 24;

/** Allowed `?type=` values: each credential type plus the "all" sentinel. */
export const TYPE_OPTIONS = ["all", ...CREDENTIAL_TYPES] as const;

export interface DirectoryParams {
  q: string;
  type: string; // one of TYPE_OPTIONS
  page: number; // 1-based, >= 1
}

/** A searchParams value can be string | string[] | undefined in Next. */
type Raw = string | string[] | undefined;

function firstString(v: Raw): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/** Validate `?type=`: return the matching credential type or "all" otherwise. */
export function parseType(raw: Raw): string {
  const v = firstString(raw).trim();
  const match = (TYPE_OPTIONS as readonly string[]).find(
    (t) => t.toLowerCase() === v.toLowerCase(),
  );
  return match ?? "all";
}

/** Parse + clamp `?page=` to an integer >= 1 (defaults to 1 on junk). */
export function parsePage(raw: Raw): number {
  const n = Number.parseInt(firstString(raw), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Trim `?q=` (name search); empty string means "no filter". */
export function parseQuery(raw: Raw): string {
  return firstString(raw).trim();
}

/** Parse all directory searchParams at once. */
export function parseParams(sp: Record<string, Raw>): DirectoryParams {
  return {
    q: parseQuery(sp.q),
    type: parseType(sp.type),
    page: parsePage(sp.page),
  };
}

/** Zero-based offset into the result set for a 1-based page. */
export function pageOffset(page: number, pageSize: number = PAGE_SIZE): number {
  const p = Math.max(1, Math.floor(page));
  return (p - 1) * pageSize;
}

/** Total number of pages for a result count (>= 1 so the UI always has a page). */
export function totalPages(total: number, pageSize: number = PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/** "Showing 1–24 of 130" range label; collapses to "0 of 0" when empty. */
export function formatShowing(
  page: number,
  rowsOnPage: number,
  total: number,
  pageSize: number = PAGE_SIZE,
): string {
  if (total <= 0 || rowsOnPage <= 0) return "Showing 0 of 0";
  const start = pageOffset(page, pageSize) + 1;
  const end = start + rowsOnPage - 1;
  return `Showing ${start}–${end} of ${total}`;
}

/** Build a /directory querystring preserving filters, overriding given keys. */
export function buildQuery(
  current: DirectoryParams,
  override: Partial<DirectoryParams> = {},
): string {
  const merged = { ...current, ...override };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.type && merged.type !== "all") sp.set("type", merged.type);
  if (merged.page > 1) sp.set("page", String(merged.page));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
