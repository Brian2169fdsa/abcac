"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { executeApprovedRun, rejectRun } from "@/lib/automation/dispatch";

// Needs-Attention queue actions. Both RE-READ the caller's portal_role from the
// cookie-bound session server-side and gate with `isAdminRole` before touching
// the automation engine — the client never carries authorization. Mirrors the
// security shape of cockpit-actions.ts.

type ActionResult = { ok: true } | { ok: false; error: string };

const PAGE = "/admin/automation";

/** Re-read the caller from the cookie session. Returns the user id + role. */
async function requireCaller(): Promise<
  | { ok: true; userId: string; role: string | null }
  | { ok: false; error: string }
> {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  return { ok: true, userId: user.id, role: profile?.portal_role ?? null };
}

/** Approve a pending proposal — runs its staged action through the registry. ADMIN-GATED. */
export async function approveAutomationRun(runId: string): Promise<ActionResult> {
  if (!runId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const result = await executeApprovedRun(runId, caller.userId);
  if (!result.ok) return { ok: false, error: result.error ?? "execute_failed" };

  revalidatePath(PAGE);
  return { ok: true };
}

/** Reject a pending proposal — no action runs. ADMIN-GATED. */
export async function rejectAutomationRun(runId: string): Promise<ActionResult> {
  if (!runId) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const result = await rejectRun(runId, caller.userId);
  if (!result.ok) return { ok: false, error: result.error ?? "reject_failed" };

  revalidatePath(PAGE);
  return { ok: true };
}
