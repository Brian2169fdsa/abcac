import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Request-scoped Supabase client bound to the user's cookie session.
 * Respects Row-Level Security — use for reading/writing the signed-in
 * member's own rows.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      },
    },
  });
}

/**
 * Service-role client that bypasses RLS. SERVER ONLY — used by the Stripe
 * webhook to attribute payments and apply credential side effects.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
