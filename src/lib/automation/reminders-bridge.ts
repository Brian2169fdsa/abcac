// ABCAC — reminders ↔ automation-engine bridge (observational only).
//
// The deterministic reminder engine (src/lib/reminders.ts + reminders-runner.ts,
// dedupe via reminder_log) predates the automation engine and KEEPS running on
// its own — it is NOT gated on automation_config. This bridge only brings its
// sends into the automation engine's visibility: when the `reminders` workflow
// is ENABLED, each reminder the legacy runner actually delivers also lands as an
// `automation_runs` row (tier auto / status auto_executed), so reminders appear
// in the admin console run history alongside everything else.
//
// Safety posture:
// - DISABLED (the shipped default) → exact legacy behavior, zero extra writes.
// - Global pause → skip the mirroring too; the pause governs the automation
//   engine, never the legacy reminders feature (those still send).
// - Best-effort: this function NEVER throws into the caller — run-logging must
//   never break reminder delivery.
//
// No registry executor is involved: there is no staged write to whitelist; the
// reminder was already sent by the legacy runner when this records it.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isGloballyPaused, getWorkflowConfig } from "./config";

export const REMINDERS_RULE_VERSION = "reminders-bridge-1";

/** The automation_config workflow key gating the mirroring (seeded OFF in 031). */
export const REMINDERS_WORKFLOW = "reminders";

/** One reminder the legacy runner actually delivered. */
export interface SentReminder {
  memberId: string;
  /** reminders.ts ReminderType (renewal_30, ceu_shortfall, task_due, ...). */
  type: string;
  /** The reminder_log dedupe key — ties the run row back to the log entry. */
  dedupeKey: string;
  subject: string;
}

/**
 * Mirror one delivered reminder into automation_runs. No-op unless the
 * `reminders` workflow is enabled AND automation is not globally paused.
 * Never throws — failures are swallowed so the legacy runner is unaffected.
 */
export async function recordReminderRun(admin: SupabaseClient, sent: SentReminder): Promise<void> {
  try {
    if (await isGloballyPaused(admin)) return;
    const cfg = await getWorkflowConfig(admin, REMINDERS_WORKFLOW);
    if (!cfg?.enabled) return;
    await admin.from("automation_runs").insert({
      workflow: REMINDERS_WORKFLOW,
      entity_type: "reminder",
      entity_id: null, // the dedupe key is not a UUID; it lives in the summary
      member_id: sent.memberId,
      tier: "auto",
      rule_version: REMINDERS_RULE_VERSION,
      staged_action: null,
      anomaly_flags: [],
      summary: `Reminder sent (${sent.type}): "${sent.subject}" [${sent.dedupeKey}]`,
      status: "auto_executed",
      resolved_at: new Date().toISOString(),
    });
  } catch {
    /* observational only — never break reminder delivery over run-logging */
  }
}
