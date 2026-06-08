import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Portal access tiers. A higher tier inherits every power of the tiers below it:
 *   member   — a signed-in credential holder (own rows only)
 *   admin    — staff who manage members and review queues
 *   superadmin — the "god account" who can also mint/demote admins
 */
export type PortalRole = "member" | "admin" | "superadmin";

const RANK: Record<PortalRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
};

const LABEL: Record<PortalRole, string> = {
  member: "Member",
  admin: "Admin",
  superadmin: "Superadmin",
};

/** Human-readable label for a role. */
export function roleLabel(role: PortalRole): string {
  return LABEL[role];
}

/** Numeric rank: member 0 < admin 1 < superadmin 2. */
export function roleRank(role: PortalRole): number {
  return RANK[role];
}

/** True when `role` is at least as privileged as `min`. */
export function isAtLeast(role: PortalRole, min: PortalRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** True only for the superadmin "god account" tier. */
export function isSuperadmin(role: PortalRole): boolean {
  return role === "superadmin";
}

/** True for admin OR superadmin (superadmins keep every admin power). */
export function isAdmin(role: PortalRole): boolean {
  return isAtLeast(role, "admin");
}

/**
 * Thin server helper: reads the signed-in user's portal_role.
 * Returns "member" when there is no session or no profile row, so callers can
 * treat the result as least-privilege by default. All decision logic lives in
 * the pure helpers above so it stays unit-testable without a DB.
 */
export async function getPortalRole(supabase: SupabaseClient): Promise<PortalRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "member";

  const { data } = await supabase
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .single();

  const role = data?.portal_role as PortalRole | undefined;
  if (role === "admin" || role === "superadmin" || role === "member") {
    return role;
  }
  return "member";
}
