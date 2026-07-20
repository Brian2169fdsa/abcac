/**
 * Repair pass after the legacy account-creation run.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/repair-legacy-certs.ts [--dry-run]
 *
 * Fixes two gaps the main run can leave behind:
 *  1. Claimed legacy rows whose certification insert failed (e.g. rejected by
 *     a since-removed constraint) — inserts the missing certifications row.
 *  2. Unclaimed rows whose (corrected) email matches an already-created
 *     member — links the row to that member and issues its certification.
 *
 * Idempotent: existing certifications (matched on member + type + number) are
 * left alone, so re-running is always safe.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rows, error } = await admin
    .from("legacy_members")
    .select("id,first_name,last_name,email,cert_type,cert_number,issued_date,expiration_date,ic_rc_level,status,claimed_by")
    .limit(5000);
  if (error || !rows) { console.error("Query failed:", error?.message); process.exit(1); }

  // Map already-claimed emails -> member id so orphan rows can be linked.
  const memberByEmail = new Map<string, string>();
  for (const r of rows) if (r.claimed_by && r.email) memberByEmail.set(r.email.toLowerCase(), r.claimed_by);

  const { data: existing, error: certError } = await admin
    .from("certifications")
    .select("member_id,cert_type,cert_number")
    .limit(10000);
  if (certError || !existing) { console.error("Cert query failed:", certError?.message); process.exit(1); }
  const have = new Set(existing.map((c) => `${c.member_id}:${c.cert_type}:${c.cert_number ?? ""}`));

  let linked = 0, inserted = 0, skipped = 0;
  for (const r of rows) {
    let memberId = r.claimed_by;
    if (!memberId && r.email) {
      memberId = memberByEmail.get(r.email.toLowerCase()) ?? null;
      if (memberId) {
        linked++;
        if (!dryRun) {
          await admin.from("legacy_members")
            .update({ claimed_by: memberId, claimed_at: new Date().toISOString() })
            .eq("id", r.id);
        }
        console.log(`${dryRun ? "[dry-run] " : ""}linked ${r.first_name} ${r.last_name} <${r.email}> to existing account`);
      }
    }
    if (!memberId || !r.cert_type) continue;
    const key = `${memberId}:${r.cert_type}:${r.cert_number ?? ""}`;
    if (have.has(key)) { skipped++; continue; }
    have.add(key);
    if (!dryRun) {
      const { error: insErr } = await admin.from("certifications").insert({
        member_id: memberId,
        cert_type: r.cert_type,
        cert_number: r.cert_number,
        issued_date: r.issued_date,
        expiration_date: r.expiration_date,
        ic_rc_level: r.ic_rc_level,
        status: r.status === "active" ? "active" : "expired",
      });
      if (insErr) { console.error(`insert failed for ${r.email} (${r.cert_type} ${r.cert_number}): ${insErr.message}`); continue; }
    }
    inserted++;
    console.log(`${dryRun ? "[dry-run] " : ""}issued ${r.cert_type} ${r.cert_number ?? ""} (${r.status}) for ${r.first_name} ${r.last_name}`);
  }
  console.log(`Done: ${inserted} certification(s) issued, ${linked} row(s) linked, ${skipped} already present.`);
}

void main();
