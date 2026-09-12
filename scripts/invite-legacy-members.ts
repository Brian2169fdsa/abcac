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
 *   --announce     — the launch campaign. For accounts ALREADY created (claimed,
 *                    never emailed) send a "your portal is ready" email through
 *                    Resend that links to /forgot, where the member requests
 *                    their own password link. Requires RESEND_API_KEY,
 *                    RESEND_FROM_EMAIL, NEXT_PUBLIC_SITE_URL. Stamps invited_at
 *                    so a re-run never emails the same person twice.
 *                    Batch with --limit (25–50/day to start).
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
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const provision = args.includes("--provision");
  const createOnly = args.includes("--create-only");
  const announce = args.includes("--announce");
  const includeInactive = args.includes("--include-inactive");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Math.max(1, Number(args[limitIndex + 1]) || 50) : 50;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!url || !serviceKey) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (announce) {
    await announceCreatedAccounts(admin, { limit, dryRun, siteUrl, includeInactive });
    return;
  }
  // Fetch every pending row (not just a slice) so a person's credential rows
  // can never be split across a page boundary — grouping by email below would
  // otherwise stamp claimed_by/invited_at on only some of a person's rows,
  // leaving the rest eligible and causing a duplicate invite next run.
  let query = admin
    .from("legacy_members")
    .select("id,first_name,last_name,email,phone,cert_type,cert_number,issued_date,expiration_date,ic_rc_level,status,address_line1,address_line2,city,state,zip_code")
    .not("email", "is", null)
    .is("invited_at", null)
    .is("claimed_by", null)
    .order("created_at");
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
  const people = Array.from(byEmail.entries()).slice(0, limit);
  console.log(`${people.length} member(s) to process (of ${byEmail.size} pending), mode=${createOnly ? "create-only" : "invite"}, provision=${provision}, includeInactive=${includeInactive}, dryRun=${dryRun}`);

  let processed = 0;
  for (const [email, records] of people) {
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

/**
 * Launch campaign: email members whose portal account already exists but who
 * have never been contacted. The email links to /forgot so the member requests
 * their own password link — that path works on every device and does not
 * depend on Supabase invite-link mechanics. One email per person; the roster
 * rows are stamped invited_at so re-runs skip them.
 */
async function announceCreatedAccounts(
  admin: SupabaseClient,
  opts: { limit: number; dryRun: boolean; siteUrl: string; includeInactive: boolean },
) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "ABCAC <noreply@abcac.org>";
  if (!opts.siteUrl) { console.error("NEXT_PUBLIC_SITE_URL is required for --announce (it becomes the portal link)."); process.exit(1); }
  if (!resendKey && !opts.dryRun) { console.error("RESEND_API_KEY is required for --announce."); process.exit(1); }

  // Fetch every pending row (not just a slice) so a person's credential rows
  // can never be split across a page boundary — grouping by email below would
  // otherwise stamp invited_at on only some of a person's rows, leaving the
  // rest eligible and causing a duplicate email on the next run.
  let query = admin
    .from("legacy_members")
    .select("id,first_name,last_name,email,status,claimed_by")
    .not("email", "is", null)
    .not("claimed_by", "is", null)
    .is("invited_at", null)
    .order("created_at");
  if (!opts.includeInactive) query = query.eq("status", "active");
  type RosterRow = { id: string; first_name: string | null; last_name: string | null; email: string | null; status: string | null; claimed_by: string | null };
  const { data, error } = await query;
  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  const rows = (data ?? []) as RosterRow[];
  if (!rows.length) { console.log("Nothing to announce — every created account has been emailed."); return; }

  const byEmail = new Map<string, RosterRow[]>();
  for (const row of rows) {
    const email = row.email!.toLowerCase();
    byEmail.set(email, [...(byEmail.get(email) ?? []), row]);
  }
  const people = Array.from(byEmail.entries()).slice(0, opts.limit);
  console.log(`${people.length} member(s) to announce, dryRun=${opts.dryRun}`);

  const forgotUrl = `${opts.siteUrl}/forgot`;
  let sent = 0;
  for (const [email, records] of people) {
    const first = records[0].first_name?.trim() || "there";
    if (opts.dryRun) { console.log(`[dry-run] would email ${email}`); continue; }
    const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#861f24">Your ABCAC member portal is ready</h2>
  <p>Hi ${escapeHtml(first)},</p>
  <p>The Arizona Board for Certification of Addiction Counselors has moved credential records online. Your account is already set up under this email address, with your certification on file.</p>
  <p><strong>To sign in for the first time, set your password:</strong></p>
  <p style="margin:20px 0"><a href="${forgotUrl}" style="background:#861f24;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Set my password</a></p>
  <ol style="color:#333">
    <li>Enter this email address (${escapeHtml(email)}) and choose “Send Reset Link”.</li>
    <li>Open the link from the email on the <em>same device and browser</em>.</li>
    <li>Choose a password. You will land on your dashboard.</li>
  </ol>
  <p>In the portal you can download your certificate and wallet card, log continuing education, upload documents, and message the board.</p>
  <p style="color:#6b7280;font-size:14px">Questions? Reply to this email or call 480-980-1770.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">ABCAC — Arizona Board for Certification of Addiction Counselors · PO Box 83165, Phoenix, AZ 85071</p>
</div>`.trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: "Your ABCAC member portal is ready", html }),
    });
    if (!res.ok) { console.error(`Send failed for ${email}: ${res.status} ${await res.text()}`); continue; }
    await admin.from("legacy_members").update({ invited_at: new Date().toISOString() }).in("id", records.map((r) => r.id));
    sent++;
    console.log(`Announced ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 400)); // stay well under Resend's per-second limit
  }
  console.log(`Done: ${sent}/${people.length} emailed.`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

void main();
