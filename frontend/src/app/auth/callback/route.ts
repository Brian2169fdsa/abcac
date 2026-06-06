import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles Supabase email-confirmation and password-recovery links: exchanges
// the one-time code for a cookie session, then forwards to `next`.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

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
