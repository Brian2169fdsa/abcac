"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole, isSuperadminRole } from "@/lib/auth/roles";

// Admin "automation CONFIG" actions: per-workflow kill switches + thresholds and
// a global pause. Every action RE-CHECKS the caller's portal_role server-side on
// the cookie-bound session — client booleans are only UI hints and are NEVER
// trusted for authorization. Each action returns a discriminated result, writes
// an `admin_audit_log` entry, and revalidates the config page.

type ActionResult = { ok: true } | { ok: false; error: string };

const CONFIG_PAGE = "/admin/automation/config";

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

/** Null or a finite number in [0, 1]. Thresholds are numeric(4,3) in the DB. */
function isValidThreshold(v: number | null): boolean {
  if (v === null) return true;
  return Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * Flip a single workflow's kill switch. ADMIN-GATED. Updates
 * `automation_config.enabled` plus `updated_at`/`updated_by` and audits the
 * transition.
 */
export async function setWorkflowEnabled(
  workflow: string,
  enabled: boolean,
): Promise<ActionResult> {
  if (!workflow) return { ok: false, error: "bad_request" };

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_config")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: caller.userId,
    })
    .eq("workflow", workflow);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "automation_config_changed",
      target_table: "automation_config",
      target_id: null,
      details: { workflow, enabled },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(CONFIG_PAGE);
  return { ok: true };
}

/**
 * Update a single workflow's auto/propose thresholds. ADMIN-GATED. Each value
 * must be null or a number in [0, 1]. Updates `automation_config` plus
 * `updated_at`/`updated_by` and audits the change.
 */
export async function setWorkflowThresholds(
  workflow: string,
  thresholds: { auto: number | null; propose: number | null },
): Promise<ActionResult> {
  if (!workflow) return { ok: false, error: "bad_request" };

  const auto = thresholds.auto;
  const propose = thresholds.propose;
  if (!isValidThreshold(auto) || !isValidThreshold(propose)) {
    return { ok: false, error: "invalid_threshold" };
  }

  const caller = await requireCaller();
  if (!caller.ok) return caller;
  if (!isAdminRole(caller.role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("automation_config")
    .update({
      auto_threshold: auto,
      propose_threshold: propose,
      updated_at: new Date().toISOString(),
      updated_by: caller.userId,
    })
    .eq("workflow", workflow);
  if (error) return { ok: false, error: error.message };

  try {
    await admin.from("admin_audit_log").insert({
      admin_id: caller.userId,
      action: "automation_config_changed",
      target_table: "automation_config",
      target_id: null,
      details: { workflow, auto_threshold: auto, propose_threshold: propose },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(CONFIG_PAGE);
  return { ok: true };
}

/**
 * Flip the engine-wide global pause. SUPERADMIN-GATED — only the "god account"
 * can stop/restart every workflow at once. The UPDATE runs through the caller's
 * OWN cookie-bound session client (not the service role): the RLS policy permits
 * the write precisely because the caller is a superadmin, keeping the DB as the
 * source of truth. Audits the change.
 */
export async function setGlobalPause(paused: boolean): Promise<ActionResult> {
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
  if (!isSuperadminRole(profile?.portal_role)) {
    return { ok: false, error: "forbidden" };
  }

  // Update via the caller's own session client — RLS allows it because the
  // caller is a superadmin.
  const { error } = await sb
    .from("automation_global")
    .update({ paused })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "automation_config_changed",
      target_table: "automation_global",
      target_id: null,
      details: { paused, scope: "global" },
    });
  } catch {
    /* best-effort */
  }

  revalidatePath(CONFIG_PAGE);
  return { ok: true };
}
