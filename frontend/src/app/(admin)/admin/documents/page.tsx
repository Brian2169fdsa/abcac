import { ReviewActions } from "@/components/admin/review-actions";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

export default async function AdminDocuments() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("documents").select("*, profiles(first_name,last_name,email)").order("uploaded_at", { ascending: false });
  const rows = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Document Review</h1>
      <p className="mb-6 text-muted">Approve or reject member-uploaded documents. Members are emailed on status changes.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">File</th>
              <th className="px-5 py-3">Uploaded</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No documents.</td></tr>
            ) : rows.map((d: any) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{[d.profiles?.first_name, d.profiles?.last_name].filter(Boolean).join(" ") || d.profiles?.email || "—"}</td>
                <td className="px-5 py-3 text-muted">{d.document_type ?? "—"}</td>
                <td className="px-5 py-3">{d.file_path ? <ViewFileButton bucket="member-documents" path={d.file_path} label={d.file_name || "View"} /> : "—"}</td>
                <td className="px-5 py-3 text-muted">{fmt(d.uploaded_at)}</td>
                <td className="px-5 py-3 capitalize text-muted">{d.status ?? "pending"}</td>
                <td className="px-5 py-3"><ReviewActions table="documents" id={d.id} status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
