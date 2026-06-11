import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortalRole, isSuperadmin } from "@/lib/auth/roles";
import { AutomationConfigPanel } from "@/components/admin/automation-config-panel";
import { AutomationTabs } from "../automation-tabs";

export const dynamic = "force-dynamic";

export interface WorkflowConfigRow {
  workflow: string;
  enabled: boolean;
  auto_threshold: number | null;
  propose_threshold: number | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export default async function AutomationConfigPage() {
  const sb = createSupabaseServerClient();

  // The admin layout already enforces admin role; here we additionally learn
  // whether the viewer is a superadmin so the global pause is interactive.
  const role = await getPortalRole(sb);
  const canPause = isSuperadmin(role);

  const [{ data: configData, error: configError }, { data: globalData, error: globalError }] =
    await Promise.all([
      sb
        .from("automation_config")
        .select("workflow,enabled,auto_threshold,propose_threshold,notes,updated_at,updated_by")
        .order("workflow", { ascending: true }),
      sb.from("automation_global").select("paused").eq("id", true).maybeSingle(),
    ]);

  const rows: WorkflowConfigRow[] = (configData as WorkflowConfigRow[] | null) ?? [];
  const paused = Boolean(globalData?.paused);
  const error = configError?.message ?? globalError?.message ?? null;

  return (
    <>
      <AutomationTabs />
      <h1 className="text-2xl font-bold">Automation Config</h1>
      <p className="mb-6 mt-2 max-w-3xl text-muted">
        Per-workflow kill switches and decision thresholds for the ABCAC automation engine.
        Every workflow ships <strong>OFF</strong> by default. Turn workflows on{" "}
        <strong>one at a time</strong>, watch their behaviour, then adjust the auto/propose
        thresholds. The global pause below stops <em>all</em> workflows at once.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading automation config: {error}
        </p>
      )}

      <AutomationConfigPanel rows={rows} paused={paused} canPause={canPause} />
    </>
  );
}
