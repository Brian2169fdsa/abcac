import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminRole } from "@/lib/auth/roles";
import { PORTAL_PREVIEW_COOKIE, isValidPortalPreviewToken } from "@/lib/portal-preview";

// Single source of auth truth for the portal/admin areas.
//
// The middleware is the ONLY place that calls getUser() (and therefore the only
// place that may refresh/rotate the session). It then forwards the validated
// user id as the `x-user-id` request header, so downstream Server Components
// read the user from the header instead of each calling getUser() themselves.
// That eliminates two failure modes at once:
//   • the refresh-token-rotation desync (Server Components can't persist a
//     rotated token, so a per-page refresh would strand the browser's token and
//     force a re-login on the next navigation), and
//   • the `user!.id` crash (a null user from a failed per-page refresh used to
//     throw in layouts → the "A critical error has occurred" global error).
// Refreshed cookies are written onto BOTH request and response, and carried on
// redirects, per the canonical @supabase/ssr pattern.
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isPublicPortalFeature = path === "/account/certification-sync";

  if (path.startsWith("/account") && !isPublicPortalFeature) {
    const previewToken = request.cookies.get(PORTAL_PREVIEW_COOKIE)?.value;
    if (!(await isValidPortalPreviewToken(previewToken))) {
      const previewUrl = request.nextUrl.clone();
      previewUrl.pathname = "/";
      previewUrl.search = "";
      previewUrl.searchParams.set("portal", "coming-soon");
      return NextResponse.redirect(previewUrl);
    }
  }

  const requestHeaders = new Headers(request.headers);
  // Strip any client-supplied spoof of our trusted header.
  requestHeaders.delete("x-user-id");
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A redirect that carries the refreshed auth cookies.
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
  if (user && path.startsWith("/account") && path !== "/account/onboarding" && !isPublicPortalFeature) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && profile.account_status !== "approved") return redirectTo("/account/onboarding");
  }

  // Forward the validated user id to Server Components so they don't each call
  // getUser() (and don't each risk a token-rotating refresh they can't persist).
  // Rebuild the pass-through response so it carries BOTH the header and any
  // cookies refreshed above.
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    const refreshed = response.cookies.getAll();
    response = NextResponse.next({ request: { headers: requestHeaders } });
    refreshed.forEach((cookie) => response.cookies.set(cookie));
  }

  return response;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
