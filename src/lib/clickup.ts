// ClickUp Tier-1 integration: push staff work items into a ClickUp list so the
// team can route work where they already live. Entirely optional — without
// CLICKUP_API_TOKEN + CLICKUP_LIST_ID this is a silent no-op (same pattern as
// Resend email). Failures never block the platform action that created the task.

const CLICKUP_API = "https://api.clickup.com/api/v2";

export interface StaffTaskPayload {
  title: string;
  detail?: string | null;
  priority?: string | null; // low | normal | high | urgent
  /** Deep link back into the admin console (member page, queue, etc.). */
  adminUrl?: string | null;
}

export const isClickUpConfigured = Boolean(process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID);

/** Map our member_tasks priority to ClickUp's 1 (urgent) … 4 (low). */
export function clickUpPriority(priority: string | null | undefined): number {
  switch ((priority ?? "").toLowerCase()) {
    case "urgent": return 1;
    case "high": return 2;
    case "low": return 4;
    default: return 3;
  }
}

/** Build the ClickUp task body (pure — unit tested). */
export function buildClickUpTask(payload: StaffTaskPayload) {
  const description = [payload.detail?.trim(), payload.adminUrl ? `Admin link: ${payload.adminUrl}` : null]
    .filter(Boolean)
    .join("\n\n");
  return {
    name: payload.title.slice(0, 250),
    description,
    priority: clickUpPriority(payload.priority),
    tags: ["abcac-portal"],
  };
}

/** Best-effort push; never throws. Returns true when a task was created. */
export async function pushTaskToClickUp(payload: StaffTaskPayload): Promise<boolean> {
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_LIST_ID;
  if (!token || !listId) return false;
  try {
    const response = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(buildClickUpTask(payload)),
    });
    if (!response.ok) {
      console.error("clickup push failed:", response.status, (await response.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (error) {
    console.error("clickup push skipped:", error);
    return false;
  }
}
