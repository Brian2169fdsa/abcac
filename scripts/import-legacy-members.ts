/**
 * Import the board's historical member database into public.legacy_members.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/import-legacy-members.ts path/to/members.csv [--batch 2026-07-19] [--dry-run]
 *
 * Accepts messy real-world CSVs: headers are matched case-insensitively against
 * common aliases (e.g. "E-mail", "Email Address" -> email). Unmapped columns
 * are preserved verbatim in source_row so nothing from the original export is
 * lost. Re-running with the same batch id replaces that batch (idempotent).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";

loadEnvConfig(process.cwd());

const HEADER_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "firstname", "first", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address", "e-mail address"],
  phone: ["phone", "phone number", "telephone", "cell", "mobile"],
  cert_type: ["cert type", "certification", "credential", "cert", "certification type", "credential type", "license type"],
  cert_number: ["cert number", "cert #", "certificate number", "certification number", "credential number", "number", "cert no", "license number"],
  issued_date: ["issued", "issue date", "issued date", "date issued", "original issue"],
  expiration_date: ["expires", "expiration", "expiration date", "expires on", "renewal date", "exp date", "exp"],
  ic_rc_level: ["ic&rc level", "icrc level", "level"],
  notes: ["notes", "comments", "remarks"],
  status: ["status", "standing", "active/inactive"],
  address_line1: ["address 1", "address1", "address", "street address", "address line 1"],
  address_line2: ["address 2", "address2", "suite", "apt", "address line 2"],
  city: ["city"],
  state: ["state", "st"],
  zip_code: ["zip code", "zip", "zipcode", "postal code"],
};

/** Normalize a status cell to active | inactive | review (default active). */
function toStatus(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (["inactive", "expired", "lapsed", "red"].includes(value)) return "inactive";
  if (["review", "unknown", "pending", "yellow", "orange"].includes(value)) return "review";
  return "active";
}

/** Minimal CSV parser supporting quoted fields and embedded commas/quotes. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
}

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!(field in mapping) && (lower === field || aliases.includes(lower))) {
        mapping[field] = header;
        break;
      }
    }
  }
  return mapping;
}

function toDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const batchIndex = args.indexOf("--batch");
  const batch = batchIndex >= 0 ? args[batchIndex + 1] : new Date().toISOString().slice(0, 10);
  if (!csvPath) { console.error("Usage: npx tsx scripts/import-legacy-members.ts members.csv [--batch id] [--dry-run]"); process.exit(1); }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

  const raw = parseCsv(readFileSync(csvPath, "utf8"));
  if (!raw.length) { console.error("No data rows parsed."); process.exit(1); }
  const mapping = mapHeaders(Object.keys(raw[0]));
  console.log("Header mapping:", mapping);
  const unmapped = Object.keys(raw[0]).filter((h) => !Object.values(mapping).includes(h));
  if (unmapped.length) console.log("Unmapped columns preserved in source_row:", unmapped.join(", "));

  const rows = raw.map((source) => ({
    first_name: source[mapping.first_name] || null,
    last_name: source[mapping.last_name] || null,
    email: (source[mapping.email] || "").toLowerCase() || null,
    phone: source[mapping.phone] || null,
    cert_type: (source[mapping.cert_type] || "").toUpperCase() || null,
    cert_number: source[mapping.cert_number] || null,
    issued_date: toDate(source[mapping.issued_date] ?? ""),
    expiration_date: toDate(source[mapping.expiration_date] ?? ""),
    ic_rc_level: source[mapping.ic_rc_level] || null,
    notes: source[mapping.notes] || null,
    status: toStatus(source[mapping.status] ?? ""),
    address_line1: source[mapping.address_line1] || null,
    address_line2: source[mapping.address_line2] || null,
    city: source[mapping.city] || null,
    state: source[mapping.state] || null,
    zip_code: source[mapping.zip_code] || null,
    source_row: source,
    import_batch: batch,
  }));

  const withIdentity = rows.filter((r) => r.email || r.cert_number || r.last_name);
  console.log(`Parsed ${rows.length} rows (${rows.length - withIdentity.length} skipped — no email/number/name), batch "${batch}".`);
  if (dryRun) {
    console.log("Dry run — first 3 rows:", JSON.stringify(withIdentity.slice(0, 3), null, 2));
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: deleteError } = await admin.from("legacy_members").delete().eq("import_batch", batch);
  if (deleteError) { console.error("Could not clear existing batch:", deleteError.message); process.exit(1); }
  for (let offset = 0; offset < withIdentity.length; offset += 500) {
    const chunk = withIdentity.slice(offset, offset + 500);
    const { error } = await admin.from("legacy_members").insert(chunk);
    if (error) { console.error(`Insert failed at ${offset}:`, error.message); process.exit(1); }
    console.log(`Inserted ${Math.min(offset + 500, withIdentity.length)}/${withIdentity.length}`);
  }
  console.log("Import complete.");
}

void main();
