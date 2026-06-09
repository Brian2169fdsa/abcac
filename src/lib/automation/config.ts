// ABCAC — automation config/kill-switch reader (server-side).
// Reads automation_global (pause) and automation_config (per-workflow enable +
// thresholds) via the service-role admin client. Thresholds live in the DB, not
// code, so they can be tuned without a deploy.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowConfig } from "./types";

export async function isGloballyPaused(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from("automation_global").select("paused").eq("id", true).maybeSingle();
  return Boolean((data as { paused?: boolean } | null)?.paused);
}

export async function getWorkflowConfig(
  admin: SupabaseClient,
  workflow: string,
): Promise<WorkflowConfig | null> {
  const { data } = await admin
    .from("automation_config")
    .select("enabled, auto_threshold, propose_threshold")
    .eq("workflow", workflow)
    .maybeSingle();
  if (!data) return null;
  const row = data as { enabled: boolean; auto_threshold: number | null; propose_threshold: number | null };
  return { enabled: row.enabled, auto: row.auto_threshold, propose: row.propose_threshold };
}
