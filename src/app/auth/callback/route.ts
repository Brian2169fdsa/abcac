import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/portal-routing";

// Handles Supabase email-confirmation and password-recovery links: exchanges
// the one-time code for a cookie session, then forwards to `next`.
//
// Two link shapes arrive here:
//   • PKCE  — `?code=…` (the browser that requested the link holds the verifier
//     cookie). Opening the email on ANOTHER device has no verifier, so the
//     exchange fails — we must surface that instead of dead-ending the member.
//   • OTP   — `?token_hash=…&type=recovery|signup|email|invite|magiclink`
//     (Supabase's non-PKCE templates and admin-generated links).
const OTP_TYPES: ReadonlySet<string> = new Set(["recovery", "signup", "email", "invite", "magiclink", "email_change"]);

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeInternalPath(searchParams.get("next"));
  const isRecovery = next.startsWith("/reset-password");

  const failure = (reason: string) => {
    // Recovery links go back to /forgot so the member can request a fresh one;
    // everything else lands on /login with an explanation.
    const target = isRecovery ? "/forgot" : "/login";
    return NextResponse.redirect(`${origin}${target}?error=${encodeURIComponent(reason)}`);
  };

  if (!code && !tokenHash) return NextResponse.redirect(`${origin}${next}`);

  try {
    const supabase = createSupabaseServerClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("auth callback: code exchange failed:", error.message);
        return failure(isRecovery ? "reset_link_invalid" : "link_invalid");
      }
    } else if (tokenHash && type && OTP_TYPES.has(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
      if (error) {
        console.warn("auth callback: otp verify failed:", error.message);
        return failure(isRecovery ? "reset_link_invalid" : "link_invalid");
      }
    } else {
      return failure("link_invalid");
    }
  } catch (err) {
    console.error("auth callback error:", err);
    return failure(isRecovery ? "reset_link_invalid" : "auth");
  }
  return NextResponse.redirect(`${origin}${next}`);
}
