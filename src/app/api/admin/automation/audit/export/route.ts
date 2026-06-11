import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import {
  parseFilters,
  applyScalarFilters,
  isAutomationScoped,
  matchesJsFilters,
  buildCsv,
  AUTOMATION_SCOPE_OR,
  EXPORT_ROW_CAP,
  type ExportRow,
} from "../audit-shared";

export const runtime = "nodejs";

// Automation Audit Explorer — CSV export. Admin-gated mirror of the
// /admin/automation/audit page query: same automation base scope, same filters,
// no pagination, capped at EXPORT_ROW_CAP. All pure logic lives in audit-shared.
export async function GET(req: Request) {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isAdminRole((profile as { portal_role: string | null }).portal_role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const sp: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const filters = parseFilters(sp);

  // Base automation-scope filter: automation_run_id IS NOT NULL OR
  // actor_type IN ('system','agent). The JS predicate re-checks defensively.
  const query = applyScalarFilters(
    sb
      .from("admin_audit_log")
      .select("*, profiles(first_name,last_name,email)")
      .or(AUTOMATION_SCOPE_OR)
      .order("created_at", { ascending: false })
      .limit(EXPORT_ROW_CAP),
    filters,
  );

  const { data } = await query;
  const rows = ((data as ExportRow[] | null) ?? [])
    .filter(isAutomationScoped)
    .filter((r) => matchesJsFilters(r, filters));

  const csv = buildCsv(rows);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abcac-automation-audit-${today}.csv"`,
    },
  });
}
