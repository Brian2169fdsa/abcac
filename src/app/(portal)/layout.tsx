import { PortalShell } from "@/components/portal/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced by middleware (redirects unauthenticated users to /login).
  // Here we read the member's name + unread message count to populate the
  // portal top bar. Failures degrade gracefully to defaults.
  let memberName = "Member";
  let messageCount = 0;

  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: profile }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name,last_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("member_id", user.id)
          .eq("is_read", false),
      ]);

      const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
      if (name) memberName = name;
      messageCount = count ?? 0;
    }
  } catch {
    // Render with defaults if Supabase is unavailable.
  }

  return (
    <PortalShell memberName={memberName} messageCount={messageCount}>
      {children}
    </PortalShell>
  );
}
