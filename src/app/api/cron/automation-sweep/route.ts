// ABCAC — automation sweep cron (manual/independent trigger).
//
// Runs the scan-based deterministic workflows (see lib/automation/sweep.ts).
// The sweep ALSO runs as part of the daily reminders cron, so it stays within
// Vercel's cron-count limits without its own schedule entry; this route exists
// for on-demand runs and testing.
//
// Auth: requires `Authorization: Bearer $CRON_SECRET` (fail closed until set).

import { runAutomationSweep } from "@/lib/automation/sweep";

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
    const summary = await runAutomationSweep();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "sweep_failed" },
      { status: 500 },
    );
  }
}
