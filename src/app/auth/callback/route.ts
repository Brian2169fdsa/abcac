import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/portal-routing";

// Handles Supabase email-confirmation and password-recovery links: exchanges
// the one-time code for a cookie session, then forwards to `next`.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    try {
      const supabase = createSupabaseServerClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
