import Link from "next/link";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { AdminCounts } from "@/components/admin/admin-nav";
import { ChatWidget } from "@/components/assistant/chat-widget";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata = { title: "ABCAC Admin Console" };
export const dynamic = "force-dynamic";

type Sb = ReturnType<typeof createSupabaseServerClient>;

async function countOf(sb: Sb, table: string, build?: (q: any) => any) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function queueCounts(sb: Sb): Promise<AdminCounts> {
  const [approvals, documents, ceus, ncReq, verReq, recReq] = await Promise.all([
    countOf(sb, "profiles", (q) => q.eq("account_status", "pending").not("account_submitted_at", "is", null)),
    countOf(sb, "documents", (q) => q.eq("status", "pending")),
    countOf(sb, "ceu_records", (q) => q.eq("status", "pending")),
    countOf(sb, "name_change_requests", (q) => q.eq("status", "pending")),
    countOf(sb, "verification_requests", (q) => q.eq("status", "pending")),
    countOf(sb, "reciprocity_requests", (q) => q.eq("status", "pending")),
  ]);
  return { approvals, documents, ceus, requests: ncReq + verReq + recReq };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already requires a session; here we enforce admin role.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("portal_role,first_name,last_name").eq("id", user!.id).maybeSingle();

  if (!profile || !isAdminRole(profile.portal_role)) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1>Not authorized</h1>
        <p className="mt-3 text-muted">This area is for ABCAC staff. If you believe this is an error, contact ABCAC.</p>
        <Link href="/account" className="mt-6 inline-block font-semibold text-brand hover:text-brand-600">Go to your account →</Link>
      </div>
    );
  }

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Admin";
  const counts = await queueCounts(supabase);

  return (
    <AdminSidebar name={name} counts={counts}>
      {children}
      <ChatWidget surface="admin" />
    </AdminSidebar>
  );
}
