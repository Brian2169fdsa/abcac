import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Read the authenticated member id WITHOUT calling getUser() in the Server
// Component. The middleware validated the session once and forwarded the id as
// the `x-user-id` header (see src/middleware.ts), so pages/layouts read it from
// there — avoiding the per-page token refresh that strands the browser's
// rotated refresh token and forces a re-login. A getUser() fallback keeps it
// correct for any route the middleware didn't tag (it never wrongly locks out).

/** The signed-in member id from the middleware header, or null. */
export function optionalUserId(): string | null {
  return headers().get("x-user-id");
}

/**
 * The signed-in member id, or a redirect to /login. Header fast-path first;
 * falls back to a validated getUser() so it's safe even off the matcher.
 */
export async function requireUserId(): Promise<string> {
  const fromHeader = headers().get("x-user-id");
  if (fromHeader) return fromHeader;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}
