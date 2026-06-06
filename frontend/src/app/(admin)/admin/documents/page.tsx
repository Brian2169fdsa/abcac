import { ReviewActions } from "@/components/admin/review-actions";
import { ViewFileButton } from "@/components/view-file-button";
import { RequestDocumentForm } from "@/components/admin/request-document";
import { FulfillRequestButton } from "@/components/admin/fulfill-request-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

interface ProfileEmbed {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface ProfileRow extends ProfileEmbed {
  id: string;
}

interface DocumentRow {
  id: string;
  document_type: string | null;
  file_name: string | null;
  file_path: string | null;
  uploaded_at: string | null;
  status: string | null;
  profiles: ProfileEmbed | null;
}

interface DocumentRequestRow {
  id: string;
  document_type: string;
  note: string | null;
  status: string;
  created_at: string | null;
  profiles: ProfileEmbed | null;
}

function memberName(p: ProfileEmbed | null): string {
  if (!p) return "—";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return full || p.email || "—";
}

export default async function AdminDocuments() {
  const sb = createSupabaseServerClient();

  const [
    { data: docData },
    { data: profileData },
    { data: reqData },
  ] = await Promise.all([
    sb.from("documents").select("*, profiles(first_name,last_name,email)").order("uploaded_at", { ascending: false }),
    sb.from("profiles").select("id,first_name,last_name,email").order("last_name", { ascending: true }),
    sb.from("document_requests").select("*, profiles(first_name,last_name,email)").eq("status", "open").order("created_at", { ascending: false }),
  ]);

  const rows = (docData as DocumentRow[]) ?? [];
  const members = ((profileData as ProfileRow[]) ?? []).map((p) => ({
    id: p.id,
    label: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—",
  }));
  const openRequests = (reqData as DocumentRequestRow[]) ?? [];

  return (
    <>
      {/* Request a document from a member */}
      <h1 className="text-2xl font-bold">Request a Document</h1>
      <p className="mb-6 text-muted">Ask a member to upload a specific document. They will see the request highlighted on their Documents page.</p>
      <div className="mb-10">
        <RequestDocumentForm members={members} />
      </div>

      {/* Open document requests */}
      <h2 className="mb-2 text-xl font-bold">Open Document Requests</h2>
      <p className="mb-4 text-muted">Requests that have not yet been fulfilled by the member.</p>
      <div className="mb-10 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Requested Document</th>
              <th className="px-5 py-3">Note</th>
              <th className="px-5 py-3">Requested</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {openRequests.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No open requests.</td></tr>
            ) : openRequests.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{memberName(r.profiles)}</td>
                <td className="px-5 py-3 font-semibold">{r.document_type}</td>
                <td className="px-5 py-3 text-muted">{r.note ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{fmt(r.created_at)}</td>
                <td className="px-5 py-3"><FulfillRequestButton id={r.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Existing document review table */}
      <h2 className="mb-2 text-xl font-bold">Document Review</h2>
      <p className="mb-4 text-muted">Approve or reject member-uploaded documents. Members are emailed on status changes.</p>
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
            ) : rows.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{memberName(d.profiles)}</td>
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
