import { ReviewActions } from "@/components/admin/review-actions";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

export default async function AdminCeus() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("ceu_records").select("*, profiles(first_name,last_name,email)").order("submitted_at", { ascending: false });
  const rows = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">CEU Review</h1>
      <p className="mb-6 text-muted">Approve or reject submitted continuing-education hours.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Hrs</th>
              <th className="px-5 py-3">Category</th><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Cert</th>
              <th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-muted">No CEU submissions.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{[r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") || r.profiles?.email || "—"}</td>
                <td className="px-5 py-3 text-muted">{r.course_name ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{r.hours ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{r.category ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{fmt(r.completion_date)}</td>
                <td className="px-5 py-3">{r.certificate_url ? <ViewFileButton bucket="ceu-certificates" path={r.certificate_url} /> : "—"}</td>
                <td className="px-5 py-3 capitalize text-muted">{r.status ?? "pending"}</td>
                <td className="px-5 py-3"><ReviewActions table="ceu_records" id={r.id} status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
