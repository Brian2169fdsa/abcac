// ABCAC — events Edge Function
// Single entry point for Supabase Database Webhooks. Sends the right email
// when a row is inserted:
//   • profiles                 → welcome email to the new member
//   • documents                → "new document to review" alert to admins
//   • ceu_records              → "new CEU to review" alert to admins
//   • name_change_requests     → alert to admins
//   • verification_requests    → alert to admins
//   • reciprocity_requests     → alert to admins
//
// Deploy (called by Supabase webhooks, no end-user JWT):
//   supabase functions deploy events --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=noreply@abcac.org ADMIN_EMAIL=abcac@abcac.org
//
// Wire each table's INSERT to this function as a Database Webhook (see
// AUTOMATIONS.md). All sends are best-effort; failures are logged, not thrown.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@abcac.org";
const PORTAL = Deno.env.get("VERCEL_URL") ?? "https://portal.abcac.org";

Deno.serve(async (req) => {
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return ok({ emailed: false, reason: "RESEND_API_KEY not set" });

    const payload = await req.json();
    const table: string = payload.table;
    const record = payload.record ?? {};
    const type: string = payload.type; // INSERT / UPDATE / DELETE
    if (type !== "INSERT") return ok({ skipped: true });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (table === "profiles") {
      await send(record.email, "Welcome to the ABCAC Member Portal",
        `<p>Welcome${record.first_name ? " " + record.first_name : ""}!</p>
         <p>Your ABCAC Member Portal account is ready. Sign in to complete your
         profile, upload documents, track CEUs, and manage your certifications.</p>
         <p><a href="${PORTAL}">Open the portal</a></p>`);
      return ok({ emailed: true, kind: "welcome" });
    }

    // Everything else is an admin review alert.
    const memberName = await lookupMember(admin, record.member_id ?? record.supervisor_id);
    const labels: Record<string, string> = {
      documents: "a new document",
      ceu_records: "a new CEU submission",
      name_change_requests: "a name change request",
      verification_requests: "a verification request",
      reciprocity_requests: "an IC&RC reciprocity request",
    };
    const label = labels[table];
    if (!label) return ok({ skipped: true, table });

    const admins = await adminEmails(admin);
    if (!admins.length) return ok({ emailed: false, reason: "no admin recipients" });

    await send(admins, "ABCAC: " + label + " needs review",
      `<p>${memberName} submitted ${label} in the member portal.</p>
       <p><a href="${PORTAL}/admin">Open the admin console</a> to review it.</p>`);
    return ok({ emailed: true, kind: "admin_alert", table });
  } catch (err) {
    console.error("events error", err);
    return ok({ error: String(err) });
  }
});

async function lookupMember(admin: ReturnType<typeof createClient>, id?: string) {
  if (!id) return "A member";
  const { data } = await admin.from("profiles").select("first_name,last_name,email").eq("id", id).single();
  if (!data) return "A member";
  return ((data.first_name ?? "") + " " + (data.last_name ?? "")).trim() || data.email || "A member";
}

async function adminEmails(admin: ReturnType<typeof createClient>) {
  const list: string[] = [];
  const { data } = await admin.from("profiles").select("email").eq("portal_role", "admin");
  (data ?? []).forEach((r: { email: string }) => { if (r.email) list.push(r.email); });
  const fallback = Deno.env.get("ADMIN_EMAIL");
  if (!list.length && fallback) list.push(fallback);
  return list;
}

async function send(to: string | string[], subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) console.error("resend failed", await res.text());
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
