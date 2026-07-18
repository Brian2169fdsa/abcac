import { AppStatusControl } from "@/components/admin/app-status-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function title(s: string | null) { return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()); }

function syncDetails(notes: string | null) {
  if (!notes) return null;
  try {
    const details = JSON.parse(notes) as { requestKind?: string; submissionMode?: string; credentials?: unknown[]; monthsForward?: number; totalAmountCents?: number; paperFileName?: string | null };
    return details.requestKind === "certification_sync" ? details : null;
  } catch { return null; }
}

export default async function AdminApplications() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("applications").select("*, profiles(first_name,last_name,email)").neq("status", "draft").order("submitted_at", { ascending: false });
  const rows = data ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Applications</h1>
      <p className="mb-6 text-muted">Update certification and recertification application status. Members are emailed on changes.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Cert / request details</th>
              <th className="px-5 py-3">Signed</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No applications.</td></tr>
            ) : rows.map((a: any) => {
              const sync = a.app_type === "cert_sync" ? syncDetails(a.member_notes) : null;
              return <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{[a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || a.profiles?.email || "—"}</td>
                <td className="px-5 py-3 text-muted">{title(a.app_type)}</td>
                <td className="px-5 py-3 text-muted">
                  <div>{a.cert_type ?? "—"}</div>
                  {sync && <div className="mt-1 text-xs">{sync.credentials?.length ?? 0} credential(s) · {sync.monthsForward ?? 0} month(s) · ${((sync.totalAmountCents ?? 0) / 100).toFixed(2)} · {title(sync.submissionMode ?? "digital")}{sync.paperFileName ? ` · ${sync.paperFileName}` : ""}</div>}
                </td>
                <td className="px-5 py-3 text-muted">{a.signature_name ? `✓ ${a.signature_name}` : "—"}</td>
                <td className="px-5 py-3 text-muted">{fmt(a.submitted_at)}</td>
                <td className="px-5 py-3"><AppStatusControl id={a.id} status={a.status} /></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
