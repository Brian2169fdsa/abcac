// ABCAC — scheduled-reminders Edge Function
// Run daily by pg_cron. Sends:
//   • Renewal reminders at 90, 60, and 30 days before a certification expires
//     (respecting each member's renewal_reminders preference).
//   • CEU deadline alerts when a member is behind on hours within 60 days of
//     expiry (respecting ceu_deadline_alerts preference).
//   • Auto-creates a renewal invoice (amount: $150) for any active certification
//     expiring within 30 days, provided no unpaid renewal invoice already exists
//     for that member in the past 60 days (idempotency guard).
//
// Deploy:
//   supabase functions deploy scheduled-reminders --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=noreply@abcac.org
// Schedule with pg_cron (see migration 003_automations.sql / AUTOMATIONS.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@abcac.org";
const PORTAL = Deno.env.get("VERCEL_URL") ?? "https://portal.abcac.org";
// Defaults used when a credential has no cert_schedules row (graceful fallback).
const DEFAULT_REQUIRED_CEU_HOURS = 40;
const REMINDER_DAYS = [90, 60, 30];
const RENEWAL_AMOUNT_CENTS = 15000; // $150.00

interface CertScheduleRow {
  credential_type: string;
  renewal_cycle_months: number;
  ceu_total_required: number;
  ceu_ethics_required: number;
  ceu_cultural_required: number;
  grace_period_days: number;
}

Deno.serve(async () => {
  // RESEND_API_KEY is optional — emails are skipped when absent but DB work
  // (invoices) still runs so we no longer early-exit here.
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  let sent = 0;
  let invoicesCreated = 0;

  // Load the per-credential renewal rules (cert_schedules) once and index them
  // by credential_type. Degrade gracefully: if the table is absent or empty we
  // fall back to the legacy 40-CEU / 90-60-30 behavior for every credential.
  const scheduleByCredential = new Map<string, CertScheduleRow>();
  try {
    const { data: schedules } = await admin
      .from("cert_schedules")
      .select(
        "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days",
      );
    for (const s of (schedules as CertScheduleRow[] | null) ?? []) {
      if (s?.credential_type) {
        scheduleByCredential.set(s.credential_type.trim().toLowerCase(), s);
      }
    }
  } catch (err) {
    console.error("cert_schedules load failed; using defaults", err);
  }

  const { data: certs } = await admin
    .from("certifications")
    .select("member_id, cert_type, expiration_date, status")
    .eq("status", "active")
    .not("expiration_date", "is", null);

  for (const cert of certs ?? []) {
    const days = Math.ceil((new Date(cert.expiration_date).getTime() - today.getTime()) / 86400000);

    // Resolve this credential's schedule-driven rules (or defaults).
    const schedule = cert.cert_type
      ? scheduleByCredential.get(String(cert.cert_type).trim().toLowerCase())
      : undefined;
    const requiredCeuHours = schedule?.ceu_total_required ?? DEFAULT_REQUIRED_CEU_HOURS;

    const { data: member } = await admin
      .from("profiles").select("email, first_name").eq("id", cert.member_id).single();
    if (!member?.email) continue;
    const { data: prefs } = await admin
      .from("notification_preferences").select("*").eq("member_id", cert.member_id).single();

    // Renewal reminder on exact threshold days
    if (REMINDER_DAYS.includes(days) && (!prefs || prefs.renewal_reminders !== false)) {
      await send(RESEND_API_KEY, member.email, `Your ${cert.cert_type} renews in ${days} days`,
        `<p>Hi ${member.first_name ?? "there"},</p>
         <p>Your <strong>${cert.cert_type}</strong> certification expires on
         ${fmt(cert.expiration_date)} — ${days} days from now. Renewal requires
         ${requiredCeuHours} CEU hours and the renewal fee.</p>
         <p><a href="${PORTAL}">Start your renewal</a></p>`);
      sent++;
    }

    // CEU deadline alert if behind on hours within 60 days
    if (days <= 60 && days > 0 && (!prefs || prefs.ceu_deadline_alerts !== false)) {
      const { data: ceus } = await admin
        .from("ceu_records").select("hours").eq("member_id", cert.member_id).eq("status", "approved");
      const total = (ceus ?? []).reduce((s: number, r: { hours: number }) => s + Number(r.hours || 0), 0);
      if (total < requiredCeuHours) {
        await send(RESEND_API_KEY, member.email, "CEU hours still needed before renewal",
          `<p>Hi ${member.first_name ?? "there"},</p>
           <p>You have <strong>${total} of ${requiredCeuHours}</strong> required CEU hours
           with ${days} days until your ${cert.cert_type} expires
           (${fmt(cert.expiration_date)}). Please complete the remaining
           ${requiredCeuHours - total} hours.</p>
           <p><a href="${PORTAL}">Log CEU hours</a></p>`);
        sent++;
      }
    }

    // Auto-create renewal invoice for certifications expiring within 30 days
    if (days <= 30 && days > 0) {
      try {
        // Idempotency guard: skip if an unpaid renewal invoice was created in
        // the last 60 days for this member.
        const cutoff = new Date(today.getTime() - 60 * 86400000).toISOString();
        const { data: existing } = await admin
          .from("invoices")
          .select("id")
          .eq("member_id", cert.member_id)
          .eq("status", "unpaid")
          .ilike("description", "%renewal%")
          .gte("created_at", cutoff)
          .limit(1);

        if (existing && existing.length > 0) {
          // A recent unpaid renewal invoice already exists — skip to avoid duplicates.
          continue;
        }

        // Generate a unique invoice number: INV-<base36 timestamp>-<random suffix>
        const invoiceNumber =
          "INV-" +
          Date.now().toString(36).toUpperCase() +
          "-" +
          Math.random().toString(36).slice(2, 6).toUpperCase();

        const description = `Certification Renewal Fee (${cert.cert_type})`;

        const { error: insertError } = await admin.from("invoices").insert({
          member_id: cert.member_id,
          invoice_number: invoiceNumber,
          description,
          amount_cents: RENEWAL_AMOUNT_CENTS,
          currency: "usd",
          status: "unpaid",
        });

        if (insertError) {
          console.error("invoice insert failed for member", cert.member_id, insertError.message);
          continue;
        }

        invoicesCreated++;

        // Notify the member that their renewal invoice is ready
        await send(
          RESEND_API_KEY,
          member.email,
          "Your ABCAC renewal invoice is ready",
          `<p>Hi ${member.first_name ?? "there"},</p>
           <p>A renewal invoice of <strong>$150.00</strong> has been created for your
           <strong>${cert.cert_type}</strong> certification, which expires on
           ${fmt(cert.expiration_date)}.</p>
           <p>Invoice number: <strong>${invoiceNumber}</strong></p>
           <p>Please log in to the portal to complete your payment and avoid a lapse
           in certification.</p>
           <p><a href="${PORTAL}">Pay your renewal invoice</a></p>`,
        );
      } catch (err) {
        // A failure for one member must not abort the rest of the run.
        console.error("invoice processing error for member", cert.member_id, err);
      }
    }
  }

  return ok({ sent, invoicesCreated });
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
async function send(key: string | null, to: string, subject: string, html: string) {
  // No-op when RESEND_API_KEY is absent so DB-only runs (e.g. invoice creation)
  // still proceed without attempting unauthenticated email delivery.
  if (!key) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) console.error("resend failed", await res.text());
}
function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
