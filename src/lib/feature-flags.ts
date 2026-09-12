// Both surfaces now run on real data (roster/tasks/analytics + report
// aggregates), so they default ON. Set the env var to "false" in Vercel to
// hide one temporarily.
export const agentWorkspaceEnabled =
  process.env.NEXT_PUBLIC_AGENT_WORKSPACE_ENABLED !== "false";

export const adminReportsDashboardEnabled =
  process.env.NEXT_PUBLIC_ADMIN_REPORTS_DASHBOARD_ENABLED !== "false";

/**
 * Online payments switch. Every Stripe entry point (portal Payments page,
 * invoice Pay Now, application fee links, exam / sync / reciprocity checkout,
 * and both checkout API routes) honours this. Set NEXT_PUBLIC_PAYMENTS_ENABLED
 * to "false" in Vercel to launch the credential/records portal before live
 * Stripe is verified; members see a clear "payments open soon" notice and can
 * still submit every form and request. Flip back on with no code change.
 */
export const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED !== "false";

export const PAYMENTS_PAUSED_TITLE = "Online payment opens shortly";
export const PAYMENTS_PAUSED_BODY =
  "Your form or request is saved and visible to ABCAC staff. Card payment in the portal is not switched on yet — you can pay by check or money order payable to \"ABCAC\" (PO Box 83165, Phoenix, AZ 85071) or wait for the notice that online payment is open. Nothing you submitted is lost.";
