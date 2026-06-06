// ABCAC — scheduled-reminders Edge Function
// Run daily by pg_cron. Sends:
//   • Renewal reminders at 90, 60, and 30 days before a certification expires
//     (respecting each member's renewal_reminders preference).
//   • CEU deadline alerts when a member is behind on hours within 60 days of
//     expiry (respecting ceu_deadline_alerts preference).
//
// Deploy:
//   supabase functions deploy scheduled-reminders --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=noreply@abcac.org
// Schedule with pg_cron (see migration 003_automations.sql / AUTOMATIONS.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@abcac.org";
const PORTAL = Deno.env.get("VERCEL_URL") ?? "https://portal.abcac.org";
const REQUIRED_CEU_HOURS = 40;
const REMINDER_DAYS = [90, 60, 30];

Deno.serve(async () => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return ok({ sent: 0, reason: "RESEND_API_KEY not set" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  let sent = 0;

  const { data: certs } = await admin
    .from("certifications")
    .select("member_id, cert_type, expiration_date, status")
    .eq("status", "active")
    .not("expiration_date", "is", null);

  for (const cert of certs ?? []) {
    const days = Math.ceil((new Date(cert.expiration_date).getTime() - today.getTime()) / 86400000);

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
         ${REQUIRED_CEU_HOURS} CEU hours and the renewal fee.</p>
         <p><a href="${PORTAL}">Start your renewal</a></p>`);
      sent++;
    }

    // CEU deadline alert if behind on hours within 60 days
    if (days <= 60 && days > 0 && (!prefs || prefs.ceu_deadline_alerts !== false)) {
      const { data: ceus } = await admin
        .from("ceu_records").select("hours").eq("member_id", cert.member_id).eq("status", "approved");
      const total = (ceus ?? []).reduce((s: number, r: { hours: number }) => s + Number(r.hours || 0), 0);
      if (total < REQUIRED_CEU_HOURS) {
        await send(RESEND_API_KEY, member.email, "CEU hours still needed before renewal",
          `<p>Hi ${member.first_name ?? "there"},</p>
           <p>You have <strong>${total} of ${REQUIRED_CEU_HOURS}</strong> required CEU hours
           with ${days} days until your ${cert.cert_type} expires
           (${fmt(cert.expiration_date)}). Please complete the remaining
           ${REQUIRED_CEU_HOURS - total} hours.</p>
           <p><a href="${PORTAL}">Log CEU hours</a></p>`);
        sent++;
      }
    }
  }

  return ok({ sent });
});

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
async function send(key: string, to: string, subject: string, html: string) {
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
