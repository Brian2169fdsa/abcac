import { RequestReviewActions } from "@/components/admin/request-review-actions";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function name(p: any) { return [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "—"; }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3 font-semibold">{title}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default async function AdminRequests() {
  const sb = createSupabaseServerClient();
  const [nc, ver, rec] = await Promise.all([
    sb.from("name_change_requests").select("*, profiles(first_name,last_name,email)").order("submitted_at", { ascending: false }),
    sb.from("verification_requests").select("*, profiles(first_name,last_name,email)").order("submitted_at", { ascending: false }),
    sb.from("reciprocity_requests").select("*, profiles(first_name,last_name,email)").order("submitted_at", { ascending: false }),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Member Requests</h1>
      <p className="mb-6 text-muted">Name changes, verification letters, and IC&amp;RC reciprocity transfers.</p>

      <Card title="Name Change Requests">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Member</th><th className="px-5 py-3">Current</th><th className="px-5 py-3">New</th>
            <th className="px-5 py-3">Reason</th><th className="px-5 py-3">Doc</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {(nc.data ?? []).length === 0 ? <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">None.</td></tr> :
              (nc.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{name(r.profiles)}</td>
                  <td className="px-5 py-3 text-muted">{r.current_name}</td>
                  <td className="px-5 py-3 text-muted">{r.new_name}</td>
                  <td className="px-5 py-3 text-muted">{r.reason}</td>
                  <td className="px-5 py-3">{r.doc_path ? <ViewFileButton bucket="name-change-docs" path={r.doc_path} /> : "—"}</td>
                  <td className="px-5 py-3 capitalize text-muted">{r.status}</td>
                  <td className="px-5 py-3"><RequestReviewActions table="name_change_requests" id={r.id} status={r.status} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>

      <Card title="Verification Requests">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Source</th><th className="px-5 py-3">Requester</th><th className="px-5 py-3">Verifying</th>
            <th className="px-5 py-3">Reason</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Result</th><th className="px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {(ver.data ?? []).length === 0 ? <tr><td colSpan={7} className="px-5 py-6 text-center text-muted">None.</td></tr> :
              (ver.data ?? []).map((r: any) => {
                const isPublic = r.source === "public";
                const requester = isPublic
                  ? [r.requester_name, r.organization].filter(Boolean).join(" · ")
                  : name(r.profiles);
                const subject = [r.subject_name, r.subject_cert_number].filter(Boolean).join(" · ") || (isPublic ? "—" : name(r.profiles));
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><span className="rounded px-2 py-0.5 text-xs font-medium capitalize text-muted">{r.source ?? "portal"}</span></td>
                    <td className="px-5 py-3">
                      <div>{requester || "—"}</div>
                      <div className="text-xs text-muted">{r.requester_email ?? r.recipient_email ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3 text-muted">{subject}</td>
                    <td className="px-5 py-3 text-muted">{r.purpose}</td>
                    <td className="px-5 py-3 capitalize text-muted">{r.status}</td>
                    <td className="px-5 py-3 capitalize text-muted">{r.verification_result ? r.verification_result.replace(/_/g, " ") : "—"}</td>
                    <td className="px-5 py-3"><RequestReviewActions table="verification_requests" id={r.id} status={r.status} /></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      <Card title="Reciprocity Requests">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Member</th><th className="px-5 py-3">Direction</th><th className="px-5 py-3">Credential</th>
            <th className="px-5 py-3">Destination</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {(rec.data ?? []).length === 0 ? <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">None.</td></tr> :
              (rec.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{name(r.profiles)}</td>
                  <td className="px-5 py-3 capitalize text-muted">{(r.direction ?? "").replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-muted">{r.credential ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{r.destination ?? "—"}</td>
                  <td className="px-5 py-3 capitalize text-muted">{r.status}</td>
                  <td className="px-5 py-3"><RequestReviewActions table="reciprocity_requests" id={r.id} status={r.status} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
