import { PortalShell } from "@/components/portal/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
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

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: profile }, { count }, unread, recent] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name,portal_role")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("member_id", user.id)
          .eq("is_read", false),
        fetchUnreadCount(supabase),
        fetchNotifications(supabase, { limit: 8 }),
      ]);

      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
      if (name) memberName = name;
      messageCount = count ?? 0;
      isAdmin = isAdminRole((profile as { portal_role?: string | null } | null)?.portal_role);
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
      notificationCount={notificationCount}
      notifications={notifications}
    >
      {children}
    </PortalShell>
  );
}
