import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let authed = false;
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    authed = Boolean(data.user);
  } catch {
    authed = false;
  }

  return (
    <>
      <SiteHeader authed={authed} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
