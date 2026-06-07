// ABCAC — admin-notify Edge Function
// Sends a transactional email to a member when an admin acts on their
// record (CEU approved/rejected, document reviewed, application status, etc.).
//
// This is the secure, server-side home for privileged actions: it runs with
// the SERVICE_ROLE key (never exposed to the browser) and is the natural
// place to later add Stripe charge creation and other privileged operations.
//
// Deploy:
//   supabase functions deploy admin-notify
//   supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=noreply@abcac.org
//
// The admin console calls this best-effort (non-blocking): the DB write is the
// source of truth, so email failure never blocks an admin action.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    // Verify the caller is a signed-in admin before doing anything privileged.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: profile } = await admin
      .from("profiles").select("portal_role").eq("id", user.id).single();
    if (!profile || profile.portal_role !== "admin") {
      return json({ error: "forbidden" }, 403);
    }

    const { member_id, subject, message } = await req.json();
    if (!member_id || !subject) return json({ error: "missing fields" }, 400);

    const { data: member } = await admin
      .from("profiles").select("email, first_name").eq("id", member_id).single();
    if (!member?.email) return json({ error: "member email not found" }, 404);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      // Email not configured yet — succeed quietly so the admin flow is unaffected.
      return json({ ok: true, emailed: false, reason: "RESEND_API_KEY not set" });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@abcac.org",
        to: member.email,
        subject,
        html: `<p>Hi ${member.first_name ?? "there"},</p><p>${message ?? subject}</p>
               <p>You can view the details in your <a href="https://portal.abcac.org">ABCAC Member Portal</a>.</p>
               <p>— Arizona Board for Certification of Addiction Counselors</p>`,
      }),
    });

    return json({ ok: res.ok, emailed: res.ok });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
