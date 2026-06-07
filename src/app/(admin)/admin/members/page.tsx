import { MemberManage } from "@/components/admin/member-manage";
import { IssueCertForm } from "@/components/admin/issue-cert-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

export default async function AdminMembers() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
  const rows = data ?? [];

  const memberOptions = rows.map((p: any) => ({
    id: p.id as string,
    label: [
      [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      p.email ? `(${p.email})` : null,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <>
      <h1 className="text-2xl font-bold">Members</h1>
      <p className="mb-6 text-muted">Directory of all member accounts. Adjust account status or role and save.</p>

      <h2 className="mb-3 text-lg font-semibold">Issue a certification</h2>
      <div className="mb-8">
        <IssueCertForm members={memberOptions} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Cert status</th>
              <th className="px-5 py-3">Joined</th><th className="px-5 py-3">Account / Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No members.</td></tr>
            ) : rows.map((p: any) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-5 py-3 text-muted">{p.email}</td>
                <td className="px-5 py-3 capitalize text-muted">{(p.cert_status ?? "—").replace(/_/g, " ")}</td>
                <td className="px-5 py-3 text-muted">{fmt(p.created_at)}</td>
                <td className="px-5 py-3"><MemberManage id={p.id} accountStatus={p.account_status} role={p.portal_role} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
