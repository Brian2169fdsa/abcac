import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Sign-out MUST be a POST. The old GET handler called signOut(), and Next.js
// <Link> PREFETCHES visible links — so merely rendering a page with a
// "Sign Out" link silently revoked the session in the background, logging the
// user out on their next navigation (the "re-login on every tab switch" bug).
// GET is now side-effect free; the SignOutButton submits a POST form here.

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — clear and redirect regardless
  }
  // 303 so the browser follows the redirect with GET after the POST.
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}

/** Side-effect free: a stale GET (bookmark, prefetch) just goes home. */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/", req.url));
}
