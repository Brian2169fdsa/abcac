/**
 * Create/invite portal accounts for imported legacy members.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/invite-legacy-members.ts [--limit 50] [--provision] [--create-only] \
 *       [--include-inactive] [--dry-run]
 *
 * Two modes:
 *   default        — sends a Supabase auth invite email; the member sets a
 *                    password via the link and lands in the portal.
 *   --create-only  — creates the account WITHOUT sending any email (for
 *                    pre-populating the portal before the email domain is
 *                    ready). Members later get a password-setup email, or use
 *                    "Forgot password" on the login page.
 *
 * With --provision, the account is also pre-approved and the member's
 * certification row(s) + mailing address are issued from the legacy data — so
 * they arrive to a portal that already shows their credential and downloadable
 * certificate. Inactive members get their certification recorded as expired.
 *
 * Only status=active records are processed unless --include-inactive is set
 * (which also takes status=review). Safe to re-run: processed rows are stamped
 * and skipped. Use --limit to batch (e.g. 50/day) and watch deliverability.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const provision = args.includes("--provision");
  const createOnly = args.includes("--create-only");
  const includeInactive = args.includes("--include-inactive");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Math.max(1, Number(args[limitIndex + 1]) || 50) : 50;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!url || !serviceKey) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  let query = admin
    .from("legacy_members")
    .select("id,first_name,last_name,email,phone,cert_type,cert_number,issued_date,expiration_date,ic_rc_level,status,address_line1,address_line2,city,state,zip_code")
    .not("email", "is", null)
    .is("invited_at", null)
    .is("claimed_by", null)
    .order("created_at")
    .limit(limit);
  if (!includeInactive) query = query.eq("status", "active");
  const { data: pending, error } = await query;
  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!pending?.length) { console.log("Nothing to process — every matching record is done."); return; }

  // One person can hold several credentials (several rows) — one account per email.
  const byEmail = new Map<string, typeof pending>();
  for (const row of pending) {
    const email = row.email!.toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
  }
  console.log(`${byEmail.size} member(s) to process (${pending.length} credential rows), mode=${createOnly ? "create-only" : "invite"}, provision=${provision}, includeInactive=${includeInactive}, dryRun=${dryRun}`);

  let processed = 0;
  for (const [email, records] of Array.from(byEmail.entries())) {
    const primary = records[0];
    const name = [primary.first_name, primary.last_name].filter(Boolean).join(" ") || email;
    const label = records.map((r: typeof primary) => `${r.cert_type ?? "?"}${r.status === "active" ? "" : ` (${r.status})`}`).join(", ");
    if (dryRun) { console.log(`[dry-run] would ${createOnly ? "create" : "invite"} ${name} <${email}> — ${label}`); continue; }

    const metadata = {
      first_name: primary.first_name,
      last_name: primary.last_name,
      phone: primary.phone,
      cert_status: primary.status === "active" ? "active_holder" : "former_holder",
      cert_numbers: records.map((r: typeof primary) => [r.cert_type, r.cert_number].filter(Boolean).join(" ")).join(", "),
    };

    let memberId: string | null = null;
    if (createOnly) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (createError || !created?.user) {
        console.error(`Create failed for ${email}: ${createError?.message ?? "no user returned"} — skipping.`);
        continue;
      }
      memberId = created.user.id;
    } else {
      const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        ...(siteUrl ? { redirectTo: `${siteUrl}/auth/callback?next=/account` } : {}),
      });
      if (inviteError || !invite?.user) {
        console.error(`Invite failed for ${email}: ${inviteError?.message ?? "no user returned"} — skipping.`);
        continue;
      }
      memberId = invite.user.id;
    }

    if (provision) {
      // Pre-approve, fill the profile from legacy data, and issue credentials
      // so the portal is complete on arrival.
      const { error: profileError } = await admin.from("profiles").update({
        account_status: "approved",
        account_reviewed_at: new Date().toISOString(),
        cert_status: metadata.cert_status,
        phone: primary.phone,
        address_line1: primary.address_line1,
        city: primary.city,
        state: primary.state,
        zip_code: primary.zip_code,
      }).eq("id", memberId);
      if (profileError) console.error(`Profile update failed for ${email}: ${profileError.message}`);

      const seenNumbers = new Set<string>();
      for (const r of records) {
        if (!r.cert_type) continue;
        const dedupeKey = `${r.cert_type}:${r.cert_number ?? ""}`;
        if (seenNumbers.has(dedupeKey)) continue;
        seenNumbers.add(dedupeKey);
        // Row-at-a-time so one duplicate cert number doesn't sink the rest.
        const { error: certError } = await admin.from("certifications").insert({
          member_id: memberId,
          cert_type: r.cert_type,
          cert_number: r.cert_number,
          issued_date: r.issued_date,
          expiration_date: r.expiration_date,
          ic_rc_level: r.ic_rc_level,
          status: r.status === "active" ? "active" : "expired",
        });
        if (certError) console.error(`Cert issue failed for ${email} (${r.cert_type} ${r.cert_number}): ${certError.message}`);
      }
    }

    const now = new Date().toISOString();
    await admin.from("legacy_members")
      .update({
        claimed_by: memberId,
        claimed_at: now,
        // invited_at only when an email actually went out — create-only leaves
        // it null so a later email campaign can find un-notified accounts.
        ...(createOnly ? {} : { invited_at: now }),
      })
      .in("id", records.map((r: typeof primary) => r.id));
    processed++;
    console.log(`${createOnly ? "Created" : "Invited"} ${name} <${email}>${provision ? " (provisioned)" : ""} — ${label}`);
    if (!createOnly) await new Promise((resolve) => setTimeout(resolve, 250)); // gentle on the email sender
  }
  console.log(`Done: ${processed}/${byEmail.size} processed.`);
}

void main();
