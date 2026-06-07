/**
 * Idempotently import the ABCAC cert-schedule reference data into the
 * public.cert_schedules table (see migration 016_cert_schedules.sql).
 *
 * Reads a CSV with the header:
 *   credential_type,renewal_cycle_months,ceu_total_required,
 *   ceu_ethics_required,ceu_cultural_required,grace_period_days,notes
 *
 * and UPSERTs each row keyed on credential_type via the Supabase service-role
 * key (writes bypass RLS). Re-running is safe — existing rows are updated.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npx tsx scripts/import-cert-schedules.ts [path/to/cert-schedules.csv]
 *
 * The CSV path may be given as the first CLI arg or via CERT_SCHEDULES_CSV.
 * It defaults to data/cert-schedules.csv, falling back to the shipped
 * data/cert-schedules.sample.csv when no real export is present yet.
 *
 * Secrets are read from the environment by name and are never hardcoded.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface CertScheduleRow {
  credential_type: string;
  renewal_cycle_months: number;
  ceu_total_required: number;
  ceu_ethics_required: number;
  ceu_cultural_required: number;
  grace_period_days: number;
  notes: string | null;
}

const NUMERIC_FIELDS = [
  "renewal_cycle_months",
  "ceu_total_required",
  "ceu_ethics_required",
  "ceu_cultural_required",
  "grace_period_days",
] as const;

/** Minimal CSV parser supporting quoted fields and embedded commas/quotes. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c.trim() !== "")) rows.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((c) => c.trim() !== "")) rows.push(record);
  }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
}

function toRow(raw: Record<string, string>): CertScheduleRow {
  const credential_type = raw.credential_type?.trim();
  if (!credential_type) {
    throw new Error(`Row is missing credential_type: ${JSON.stringify(raw)}`);
  }
  const nums: Record<string, number> = {};
  for (const f of NUMERIC_FIELDS) {
    const v = raw[f]?.trim();
    const n = v === undefined || v === "" ? NaN : Number(v);
    if (Number.isNaN(n)) {
      throw new Error(`Row ${credential_type}: field "${f}" is not a number (got "${v ?? ""}")`);
    }
    nums[f] = n;
  }
  return {
    credential_type,
    renewal_cycle_months: nums.renewal_cycle_months,
    ceu_total_required: nums.ceu_total_required,
    ceu_ethics_required: nums.ceu_ethics_required,
    ceu_cultural_required: nums.ceu_cultural_required,
    grace_period_days: nums.grace_period_days,
    notes: raw.notes?.trim() ? raw.notes.trim() : null,
  };
}

function resolveCsvPath(): string {
  const fromArg = process.argv[2];
  const fromEnv = process.env.CERT_SCHEDULES_CSV;
  if (fromArg) return resolve(process.cwd(), fromArg);
  if (fromEnv) return resolve(process.cwd(), fromEnv);

  const real = resolve(process.cwd(), "data/cert-schedules.csv");
  if (existsSync(real)) return real;

  const sample = resolve(process.cwd(), "data/cert-schedules.sample.csv");
  console.warn(
    `No data/cert-schedules.csv found — falling back to the sample export.\n` +
      `Replace it with the real spreadsheet (same header) and re-run.`,
  );
  return sample;
}

async function run(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (read from env).",
    );
    process.exit(1);
  }

  const csvPath = resolveCsvPath();
  const csv = readFileSync(csvPath, "utf8");
  const rows = parseCsv(csv).map(toRow);
  if (rows.length === 0) {
    console.error(`No data rows parsed from ${csvPath}.`);
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("cert_schedules")
    .upsert(rows, { onConflict: "credential_type" })
    .select("credential_type");

  if (error) {
    console.error(`Upsert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`Upserted ${data?.length ?? rows.length} cert_schedules row(s) from ${csvPath}:`);
  for (const r of rows) {
    console.log(
      `  ${r.credential_type.padEnd(6)} cycle=${r.renewal_cycle_months}mo ` +
        `ceu=${r.ceu_total_required}/${r.ceu_ethics_required}eth/${r.ceu_cultural_required}cul ` +
        `grace=${r.grace_period_days}d`,
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
