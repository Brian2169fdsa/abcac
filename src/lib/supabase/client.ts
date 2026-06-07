import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Browser Supabase client (anon key, RLS-enforced). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(url, anonKey);
}
