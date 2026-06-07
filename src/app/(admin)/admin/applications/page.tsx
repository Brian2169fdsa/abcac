import { AppStatusControl } from "@/components/admin/app-status-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function title(s: string | null) { return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()); }

export default async function AdminApplications() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("applications").select("*, profiles(first_name,last_name,email)").order("submitted_at", { ascending: false });
  const rows = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Applications</h1>
      <p className="mb-6 text-muted">Update certification and recertification application status. Members are emailed on changes.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Cert</th>
              <th className="px-5 py-3">Signed</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No applications.</td></tr>
            ) : rows.map((a: any) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{[a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || a.profiles?.email || "—"}</td>
                <td className="px-5 py-3 text-muted">{title(a.app_type)}</td>
                <td className="px-5 py-3 text-muted">{a.cert_type ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{a.signature_name ? `✓ ${a.signature_name}` : "—"}</td>
                <td className="px-5 py-3 text-muted">{fmt(a.submitted_at)}</td>
                <td className="px-5 py-3"><AppStatusControl id={a.id} status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
