import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { ChatWidget } from "@/components/assistant/chat-widget";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "ABCAC Admin Console" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already requires a session; here we enforce admin role.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("portal_role,first_name,last_name").eq("id", user!.id).maybeSingle();

  if (!profile || profile.portal_role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1>Not authorized</h1>
        <p className="mt-3 text-muted">This area is for ABCAC staff. If you believe this is an error, contact ABCAC.</p>
        <Link href="/account" className="mt-6 inline-block font-semibold text-brand hover:text-brand-600">Go to your account →</Link>
      </div>
    );
  }

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Admin";

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-brand">
        <div className="mx-auto flex w-full max-w-content flex-col gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold text-white">ABCAC</span>
              <span className="text-[10px] uppercase tracking-wider text-white/70">Admin Console</span>
            </Link>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <span className="hidden sm:inline">{name}</span>
              <Link href="/logout" className="font-semibold text-white hover:text-white/80">Sign out</Link>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-content px-5 py-8 md:px-8">{children}</main>
      <ChatWidget surface="admin" />
    </div>
  );
}
