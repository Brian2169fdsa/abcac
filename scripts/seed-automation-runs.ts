/**
 * Seed realistic DEMO automation_runs (+ matching admin_audit_log rows) so the
 * Automation Analytics surface has something to show before workflows are
 * enabled in production. Every seeded row is marked with the `[demo]` summary
 * prefix and `details.seed = true` on audit rows, so `--clean` can remove them.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/seed-automation-runs.ts [--days=30] [--clean]
 *
 * This is a DEV/DEMO tool — it writes synthetic rows into the audit trail. Do
 * not run it against a production tenant whose impact metrics must stay real.
 */
import { createClient } from "@supabase/supabase-js";
import { WORKFLOW_CATALOG, type WorkflowCategory } from "../src/lib/automation/catalog";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const DEMO_MARK = "[demo]";
const args = process.argv.slice(2);
const clean = args.includes("--clean");
const daysArg = args.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? Math.max(1, Math.min(120, Number(daysArg.split("=")[1]) || 30)) : 30;

const DAY_MS = 86_400_000;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

// Status mix per category: weighted draws that mirror how each kind of workflow
// actually behaves once enabled.
const STATUS_MIX: Record<WorkflowCategory, [string, number][]> = {
  deterministic: [["auto_executed", 70], ["escalated", 18], ["failed", 5], ["pending_approval", 7]],
  agent: [["auto_executed", 45], ["pending_approval", 20], ["approved", 12], ["escalated", 20], ["failed", 3]],
  human_gate: [["escalated", 100]],
  observational: [["auto_executed", 100]],
};

function drawStatus(category: WorkflowCategory): string {
  const mix = STATUS_MIX[category];
  const total = mix.reduce((n, [, w]) => n + w, 0);
  let r = Math.random() * total;
  for (const [status, w] of mix) {
    if ((r -= w) <= 0) return status;
  }
  return mix[0][0];
}

const tierForStatus = (s: string): string =>
  s === "escalated" ? "escalate" : s === "pending_approval" || s === "approved" ? "propose" : "auto";

async function cleanSeed() {
  const { error: aErr } = await admin.from("admin_audit_log").delete().eq("details->>seed", "true");
  const { error: rErr } = await admin.from("automation_runs").delete().ilike("summary", `${DEMO_MARK}%`);
  if (aErr || rErr) {
    console.error("Cleanup error:", aErr?.message ?? rErr?.message);
    process.exit(1);
  }
  console.log(`Removed demo automation_runs and audit rows (marker "${DEMO_MARK}").`);
}

async function run() {
  if (clean) return cleanSeed();

  const { data: members } = await admin.from("profiles").select("id").limit(200);
  const memberIds = (members as { id: string }[] | null)?.map((m) => m.id) ?? [];
  if (memberIds.length === 0) {
    console.error("No member profiles found to attribute runs to.");
    process.exit(1);
  }

  let runs = 0;
  let audits = 0;
  for (let d = DAYS - 1; d >= 0; d--) {
    const dayStart = Date.now() - d * DAY_MS;
    for (const wf of WORKFLOW_CATALOG) {
      // Volume scales with category; human gates and observational are sparse.
      const volume =
        wf.category === "deterministic" ? randInt(1, 6) : wf.category === "agent" ? randInt(0, 3) : randInt(0, 1);
      for (let i = 0; i < volume; i++) {
        const status = drawStatus(wf.category);
        const createdAt = new Date(dayStart + randInt(0, DAY_MS - 1)).toISOString();
        const memberId = pick(memberIds);
        const anomalies =
          status === "escalated"
            ? [pick(["needs_review", "ambiguous_match", "low_confidence", "incomplete_profile"])]
            : status === "failed"
              ? ["state_moved"]
              : [];
        const { data: runRow } = await admin
          .from("automation_runs")
          .insert({
            workflow: wf.workflow,
            entity_type: "demo",
            member_id: memberId,
            tier: tierForStatus(status),
            confidence: wf.category === "agent" ? Math.round((0.7 + Math.random() * 0.3) * 100) / 100 : null,
            rule_version: wf.category === "agent" ? null : `${wf.workflow}-1`,
            anomaly_flags: anomalies,
            summary: `${DEMO_MARK} ${wf.label}: ${status.replace(/_/g, " ")}`,
            status,
            created_at: createdAt,
            resolved_at: status === "auto_executed" || status === "approved" ? createdAt : null,
          })
          .select("id")
          .maybeSingle();
        runs++;
        if ((status === "auto_executed" || status === "approved") && runRow) {
          await admin.from("admin_audit_log").insert({
            admin_id: null,
            action: `auto:${wf.workflow}`,
            target_table: "demo",
            details: { workflow: wf.workflow, ok: true, seed: true },
            actor_type: wf.category === "agent" ? "agent" : "system",
            decision_tier: tierForStatus(status),
            automation_run_id: (runRow as { id: string }).id,
            created_at: createdAt,
          });
          audits++;
        }
      }
    }
  }
  console.log(`Seeded ${runs} demo automation_runs and ${audits} audit rows across ${DAYS} days.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
