// ABCAC — public credential directory + verification lookup.
//
// Reads the `directory_credentials` VIEW (migration 035), which is the privacy
// boundary: it exposes only name + credential + status for ACTIVE certifications
// of members who have NOT opted out — no email/phone/DOB/SSN/address can leak,
// because those columns aren't in the view. The view is granted to anon, so the
// public site reads it with the ordinary (anon) server client; no service role.
// Functions take the client as an argument so they're unit-testable.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicCredential {
  cert_number: string;
  cert_type: string;
  status: string;
  issued_date: string | null;
  expiration_date: string | null;
  full_name: string;
  last_name: string | null;
}

const VIEW = "directory_credentials";
const SELECT = "cert_number,cert_type,status,issued_date,expiration_date,full_name,last_name";

/** Normalize a cert number for exact lookup (trim, collapse spaces, upper). */
export function normalizeCertNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/** Escape PostgREST ilike wildcards in user input so they're matched literally. */
export function escapeLike(raw: string): string {
  return raw.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * Verify a single credential by its certification number. Returns the public
 * record for an ACTIVE, listed credential, or null when nothing matches (which
 * also covers expired, opted-out, and unknown numbers — all "not verified").
 */
export async function lookupByCertNumber(
  sb: SupabaseClient,
  certNumber: string,
): Promise<PublicCredential | null> {
  const cn = normalizeCertNumber(certNumber);
  if (!cn) return null;
  const { data } = await sb
    .from(VIEW)
    .select(SELECT)
    .ilike("cert_number", cn) // exact value, ilike for case-insensitivity
    .limit(1)
    .maybeSingle();
  return (data as PublicCredential | null) ?? null;
}

export interface DirectoryQuery {
  name?: string;
  certType?: string;
  limit?: number;
  offset?: number;
}

export interface DirectoryPage {
  rows: PublicCredential[];
  total: number;
}

/** Search the public directory by name and/or credential type, paginated. */
export async function searchDirectory(
  sb: SupabaseClient,
  query: DirectoryQuery = {},
): Promise<DirectoryPage> {
  const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  let q = sb.from(VIEW).select(SELECT, { count: "exact" });
  const name = query.name?.trim();
  if (name) q = q.ilike("full_name", `%${escapeLike(name)}%`);
  const certType = query.certType?.trim();
  if (certType && certType.toLowerCase() !== "all") q = q.eq("cert_type", certType);

  const { data, count } = await q
    .order("last_name", { ascending: true })
    .order("full_name", { ascending: true })
    .range(offset, offset + limit - 1);

  return { rows: (data as PublicCredential[] | null) ?? [], total: count ?? 0 };
}

/** Distinct credential types offered (for the directory filter + display). */
export const CREDENTIAL_TYPES = [
  "CAC",
  "CADC",
  "CADAC",
  "AADC",
  "CCJP",
  "CCS",
  "CPS",
  "CPRS",
] as const;

/**
 * Human-readable label for a member's public-directory listing state, derived
 * from `profiles.directory_opt_out`. Shared by the member control and the admin
 * read-only indicator so both describe the state identically.
 */
export function directoryListingLabel(optOut: boolean | null | undefined): "Listed" | "Opted out" {
  return optOut ? "Opted out" : "Listed";
}

/** True when a credential is valid today (active + not past expiration). */
export function isCurrentlyValid(cred: PublicCredential, now: Date = new Date()): boolean {
  if (cred.status !== "active") return false;
  if (!cred.expiration_date) return true;
  const exp = Date.parse(cred.expiration_date);
  return Number.isNaN(exp) ? true : exp >= now.getTime();
}
