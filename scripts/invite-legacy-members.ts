/**
 * Invite imported legacy members to claim their ABCAC portal account.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/invite-legacy-members.ts [--limit 50] [--provision] [--dry-run]
 *
 * For each legacy_members row with an email that has not been invited or
 * claimed: sends a Supabase auth invite email (the member sets a password via
 * the link and lands in the portal). With --provision, the member's account is
 * also pre-approved and their certification row(s) issued from the legacy data
 * — so they arrive to a portal that already shows their credential and
 * downloadable certificate.
 *
 * Safe to re-run: invited rows are stamped invited_at and skipped. Use --limit
 * to batch the campaign (e.g. 50/day) and watch deliverability.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const provision = args.includes("--provision");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Math.max(1, Number(args[limitIndex + 1]) || 50) : 50;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!url || !serviceKey) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: pending, error } = await admin
    .from("legacy_members")
    .select("id,first_name,last_name,email,phone,cert_type,cert_number,issued_date,expiration_date,ic_rc_level")
    .not("email", "is", null)
    .is("invited_at", null)
    .is("claimed_by", null)
    .order("created_at")
    .limit(limit);
  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  if (!pending?.length) { console.log("Nothing to invite — every emailed record is invited or claimed."); return; }

  // One person can hold several credentials (several rows) — invite once per email.
  const byEmail = new Map<string, typeof pending>();
  for (const row of pending) {
    const email = row.email!.toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
  }
  console.log(`${byEmail.size} member(s) to invite (${pending.length} credential rows), provision=${provision}, dryRun=${dryRun}`);

  let invited = 0;
  for (const [email, records] of Array.from(byEmail.entries())) {
    const primary = records[0];
    const name = [primary.first_name, primary.last_name].filter(Boolean).join(" ") || email;
    if (dryRun) { console.log(`[dry-run] would invite ${name} <${email}> (${records.map((r: typeof primary) => r.cert_type).join(", ")})`); continue; }

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: primary.first_name,
        last_name: primary.last_name,
        phone: primary.phone,
        cert_status: "active_holder",
        cert_numbers: records.map((r: typeof primary) => [r.cert_type, r.cert_number].filter(Boolean).join(" ")).join(", "),
      },
      ...(siteUrl ? { redirectTo: `${siteUrl}/auth/callback?next=/account` } : {}),
    });
    if (inviteError || !invite?.user) {
      console.error(`Invite failed for ${email}: ${inviteError?.message ?? "no user returned"} — skipping.`);
      continue;
    }

    const memberId = invite.user.id;
    if (provision) {
      // Pre-approve and issue their credentials so the portal is ready on arrival.
      await admin.from("profiles").update({
        account_status: "approved",
        account_reviewed_at: new Date().toISOString(),
        cert_status: "active_holder",
      }).eq("id", memberId);
      const certRows = records
        .filter((r: typeof primary) => r.cert_type)
        .map((r: typeof primary) => ({
          member_id: memberId,
          cert_type: r.cert_type,
          cert_number: r.cert_number,
          issued_date: r.issued_date,
          expiration_date: r.expiration_date,
          ic_rc_level: r.ic_rc_level,
          status: "active",
        }));
      if (certRows.length) {
        const { error: certError } = await admin.from("certifications").insert(certRows);
        if (certError) console.error(`Cert issue failed for ${email}: ${certError.message}`);
      }
    }

    const now = new Date().toISOString();
    await admin.from("legacy_members")
      .update({ invited_at: now, claimed_by: memberId, claimed_at: provision ? now : null })
      .in("id", records.map((r: typeof primary) => r.id));
    invited++;
    console.log(`Invited ${name} <${email}>${provision ? " (provisioned)" : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 250)); // gentle on the email sender
  }
  console.log(`Done: ${invited}/${byEmail.size} invited.`);
}

void main();
