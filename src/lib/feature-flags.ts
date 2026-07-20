// Both surfaces now run on real data (roster/tasks/analytics + report
// aggregates), so they default ON. Set the env var to "false" in Vercel to
// hide one temporarily.
export const agentWorkspaceEnabled =
  process.env.NEXT_PUBLIC_AGENT_WORKSPACE_ENABLED !== "false";

export const adminReportsDashboardEnabled =
  process.env.NEXT_PUBLIC_ADMIN_REPORTS_DASHBOARD_ENABLED !== "false";
