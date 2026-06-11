import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminRole } from "@/lib/auth/roles";

// Refreshes the Supabase session cookie and gates the member portal / admin area.
//
// CRITICAL (auth correctness): with refresh-token ROTATION enabled, the
// middleware must be the single place that refreshes the session, and it must
// write the rotated cookies onto BOTH the response (so the browser stores them)
// AND the request (so the Server Components rendered in this same request read
// the fresh token instead of re-refreshing with the just-rotated one, which they
// can't persist — that desync is what forces a re-login on every navigation).
// Redirects must also carry the refreshed cookies.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        // 1) reflect onto the request so downstream Server Components in THIS
        //    request read the freshly-rotated token, not the stale one.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // 2) rebuild the response bound to the updated request, then write the
        //    cookies so the browser also receives the rotation.
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // A redirect that carries the refreshed auth cookies (so the rotation isn't
  // lost when the middleware both refreshes and redirects).
  const redirectTo = (pathname: string, opts?: { keepNext?: boolean }) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";
    if (opts?.keepNext) target.searchParams.set("next", path);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && (path.startsWith("/account") || path.startsWith("/admin"))) {
    return redirectTo("/login", { keepNext: true });
  }

  // Gate the admin area to admins (defense-in-depth; the layout also checks).
  if (user && path.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("portal_role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || !isAdminRole(profile.portal_role)) return redirectTo("/account");
  }

  // Gate unapproved members to the onboarding/approval flow.
  if (user && path.startsWith("/account") && path !== "/account/onboarding") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && profile.account_status !== "approved") return redirectTo("/account/onboarding");
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
