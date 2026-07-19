// Matching helpers for the imported legacy member roster: normalize the messy
// real-world identifiers (emails, free-text cert numbers) and decide whether a
// signup corresponds to a historical record. Pure functions — used by the
// import script, the invite script, and the admin approvals view.

export interface LegacyMemberRecord {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  cert_type: string | null;
  cert_number: string | null;
  expiration_date: string | null;
  claimed_by: string | null;
}

export const CREDENTIAL_TYPES = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"] as const;

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Strip a cert number down to its comparable core (drop credential prefixes,
 *  separators, and leading zeros): "CADAC-04471" -> "4471". */
export function normalizeCertNumber(raw: string | null | undefined): string {
  let value = (raw ?? "").trim().toUpperCase();
  for (const credential of CREDENTIAL_TYPES) {
    if (value.startsWith(credential)) {
      value = value.slice(credential.length);
      break;
    }
  }
  value = value.replace(/[^0-9A-Z]/g, "").replace(/^0+(?=\d)/, "");
  return value;
}

/** Tokenize a member's free-text self-reported numbers ("CADAC 4471, 887"). */
export function selfReportedTokens(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;\n]+/)
    .map((token) => normalizeCertNumber(token))
    .filter((token) => token.length >= 2);
}

export interface LegacyMatch {
  record: LegacyMemberRecord;
  matchedBy: "email" | "cert_number";
}

/** Match a signup (email + self-reported numbers) against the legacy roster. */
export function matchLegacyRecords(
  records: LegacyMemberRecord[],
  signup: { email: string | null | undefined; submittedCertNumbers: string | null | undefined },
): LegacyMatch[] {
  const email = normalizeEmail(signup.email);
  const tokens = new Set(selfReportedTokens(signup.submittedCertNumbers));
  const matches: LegacyMatch[] = [];
  for (const record of records) {
    if (email && normalizeEmail(record.email) === email) {
      matches.push({ record, matchedBy: "email" });
      continue;
    }
    const recordNumber = normalizeCertNumber(record.cert_number);
    if (recordNumber && tokens.has(recordNumber)) {
      matches.push({ record, matchedBy: "cert_number" });
    }
  }
  return matches;
}

/** One-line human summary of a legacy record for admin display. */
export function describeLegacyRecord(record: LegacyMemberRecord): string {
  const name = [record.first_name, record.last_name].filter(Boolean).join(" ") || "Unnamed record";
  const credential = [record.cert_type, record.cert_number ? `#${record.cert_number}` : null].filter(Boolean).join(" ");
  const expires = record.expiration_date ? `expires ${record.expiration_date}` : "no expiration on file";
  return [name, credential, expires].filter(Boolean).join(" · ");
}
