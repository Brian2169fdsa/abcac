import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — clear and redirect regardless
  }
  return NextResponse.redirect(new URL("/", req.url));
}
