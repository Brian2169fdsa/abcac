// ABCAC — daily reminders cron (Vercel Cron → this route)
//
// Scheduled in vercel.json ("0 14 * * *" = 14:00 UTC ≈ 7am MST). Sends renewal
// reminders (90/60/30 days), CEU-deadline alerts, document-request nudges, and
// task-due reminders — each delivered once (deduped via reminder_log) as both an
// in-portal message and an email (email no-op until RESEND_API_KEY is set).
//
// Auth: Vercel attaches `Authorization: Bearer $CRON_SECRET` to cron requests.
// We require it, so the endpoint can't be triggered anonymously. Returns 503
// until CRON_SECRET is configured (fail closed).

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runRemindersForAll } from "@/lib/reminders-runner";

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
    const summary = await runRemindersForAll(admin);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "reminder_run_failed" },
      { status: 500 },
    );
  }
}
