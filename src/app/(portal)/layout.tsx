import { PortalShell } from "@/components/portal/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { optionalUserId } from "@/lib/auth/current-user";
import { fetchNotifications, fetchUnreadCount, type Notification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced by middleware (redirects unauthenticated users to /login).
  // Here we read the member's name + unread message/notification counts to
  // populate the portal top bar. Failures degrade gracefully to defaults.
  let memberName = "Member";
  let messageCount = 0;
  let isAdmin = false;
  let notificationCount = 0;
  let notifications: Notification[] = [];
  let restricted = false;

  try {
    // The middleware already validated the session; read the id from its header
    // rather than calling getUser() here (avoids a per-request token refresh).
    const userId = optionalUserId();
    const supabase = createSupabaseServerClient();

    if (userId) {
      const [{ data: profile }, { count }, unread, recent] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name,portal_role,account_status")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("member_id", userId)
          .eq("is_read", false)
          // Only staff-authored messages count as unread for the member; their
          // own outbound messages stay is_read=false until staff open them.
          .neq("sender_role", "member"),
        fetchUnreadCount(supabase),
        fetchNotifications(supabase, { limit: 8 }),
      ]);

      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
      if (name) memberName = name;
      messageCount = count ?? 0;
      isAdmin = isAdminRole((profile as { portal_role?: string | null } | null)?.portal_role);
      // Pending accounts (approval gate on) get a minimal shell: the full sidebar
      // would only bounce them back to onboarding on every click.
      const accountStatus = (profile as { account_status?: string | null } | null)?.account_status ?? "approved";
      restricted = !isAdmin && process.env.PORTAL_ACCOUNT_APPROVAL_REQUIRED !== "false" && accountStatus !== "approved";
      notificationCount = unread;
      notifications = recent;
    }
  } catch {
    // Render with defaults if Supabase is unavailable.
  }

  return (
    <PortalShell
      memberName={memberName}
      messageCount={messageCount}
      isAdmin={isAdmin}
      restricted={restricted}
      notificationCount={notificationCount}
      notifications={notifications}
    >
      {children}
    </PortalShell>
  );
}
