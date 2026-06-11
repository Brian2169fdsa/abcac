// ABCAC — pure helpers for the public /verify instant-lookup page.
//
// These are deliberately framework-free (no Supabase, no React) so the server
// page stays thin and the parsing / decision logic is unit-testable.

import type { PublicCredential } from "@/lib/directory";

/** Raw Next.js searchParams for the /verify page (plain object in Next 14.2). */
export type VerifySearchParams = Record<string, string | string[] | undefined>;

/** Parsed + cleaned lookup inputs. */
export interface VerifyQuery {
  /** Trimmed cert number, or "" when absent/blank. */
  cert: string;
  /** Trimmed name, or "" when absent/blank. */
  name: string;
}

/** Coerce a possibly-array search param to a single trimmed string. */
export function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

/** Pull the cert + name inputs out of raw searchParams. */
export function parseVerifyParams(params: VerifySearchParams): VerifyQuery {
  return {
    cert: firstParam(params.cert),
    name: firstParam(params.name),
  };
}

/**
 * What the page should render, given the (already parsed) query:
 * - "idle"        — nothing searched yet (show just the form + intro)
 * - "cert"        — a cert number was provided; show the verify result card
 * - "name"        — only a name was provided; show the search results list
 *
 * A cert number always wins over a name (exact verification is the headline use).
 */
export type VerifyMode = "idle" | "cert" | "name";

export function decideMode(q: VerifyQuery): VerifyMode {
  if (q.cert) return "cert";
  if (q.name) return "name";
  return "idle";
}

/**
 * Result kind for a cert lookup, given the credential row (or null) returned by
 * `lookupByCertNumber` and whether it's currently valid. Kept separate from the
 * DB call so it can be tested without a client.
 * - "verified-active"  — found + valid today (green check)
 * - "verified-lapsed"  — found but not currently valid (e.g. past expiration)
 * - "not-found"        — null lookup (unknown number OR opted-out — be careful!)
 */
export type CertResultKind = "verified-active" | "verified-lapsed" | "not-found";

export function certResultKind(
  cred: PublicCredential | null,
  valid: boolean,
): CertResultKind {
  if (!cred) return "not-found";
  return valid ? "verified-active" : "verified-lapsed";
}

/** Clamp the directory search limit to the same 1..100 bounds as the lib. */
export function clampLimit(raw: number | undefined, fallback = 10): number {
  const n = raw ?? fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 100);
}

/** Format an ISO date (yyyy-mm-dd) as "May 19, 2028"; em dash when missing/bad. */
export function formatCredDate(d: string | null): string {
  if (!d) return "—";
  // Parse as a plain calendar date (avoid TZ shifting yyyy-mm-dd back a day).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  const date = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
