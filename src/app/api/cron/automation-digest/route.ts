// ABCAC — daily automation digest cron (Vercel Cron → this route).
//
// Scheduled in vercel.json ("0 13 * * *"). Emails every superadmin a summary of
// everything the automation engine did unattended in the last 24h (counts by
// status/workflow, plus per-row detail for auto-executed and failed runs) so
// spot-auditing is trivial. If nothing ran, we send nothing.
//
// Auth: Vercel attaches `Authorization: Bearer $CRON_SECRET` to cron requests.
// We require it. Returns 503 until CRON_SECRET is configured (fail closed).

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { buildDigest, type AutomationRunRow } from "@/lib/automation/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "cron_not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: runData, error: runErr } = await admin
      .from("automation_runs")
      .select(
        "created_at, workflow, entity_type, entity_id, member_id, tier, confidence, status, summary, anomaly_flags, staged_action",
      )
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false });

    if (runErr) throw new Error(runErr.message);

    const runs = (runData ?? []) as AutomationRunRow[];

    // Nothing happened — don't bother anyone.
    if (runs.length === 0) {
      return Response.json({ ok: true, runs: 0 });
    }

    const { data: admins, error: adminErr } = await admin
      .from("profiles")
      .select("email")
      .eq("portal_role", "superadmin");

    if (adminErr) throw new Error(adminErr.message);

    const recipients = (admins ?? [])
      .map((a) => (a as { email: string | null }).email)
      .filter((e): e is string => typeof e === "string" && e.length > 0);

    const digest = buildDigest(runs, sinceISO);

    let emailed = 0;
    for (const to of recipients) {
      const sent = await sendEmail({
        to,
        subject: digest.subject,
        html: digest.html,
      });
      if (sent) emailed += 1;
    }

    return Response.json({
      ok: true,
      runs: runs.length,
      recipients: recipients.length,
      emailed,
      counts: digest.counts,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "automation_digest_failed",
      },
      { status: 500 },
    );
  }
}
