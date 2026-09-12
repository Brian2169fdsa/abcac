import { AppStatusControl } from "@/components/admin/app-status-control";
import { ApplyCertSyncButton } from "@/components/admin/apply-cert-sync-button";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStoredCertSyncPlan } from "@/lib/automation/workflows/cert-sync-apply";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function title(s: string | null) { return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()); }

function syncDetails(notes: string | null) {
  if (!notes) return null;
  try {
    const details = JSON.parse(notes) as { requestKind?: string; submissionMode?: string; paperFileName?: string | null };
    if (details.requestKind !== "certification_sync") return null;
    return { ...details, plan: parseStoredCertSyncPlan(notes) };
  } catch { return null; }
}

function digitalDetails(notes: string | null) {
  if (!notes) return null;
  try {
    const details = JSON.parse(notes) as { requestKind?: string; workflowTitle?: string; submissionMode?: string; documents?: Array<{ annotations?: unknown[] }>; paperFileName?: string | null };
    return details.requestKind === "digital_application_packet" ? details : null;
  } catch { return null; }
}

export default async function AdminApplications() {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("applications").select("*, profiles(first_name,last_name,email)").neq("status", "draft").order("submitted_at", { ascending: false });
  const rows = data ?? [];

  // Fee-paid indicator: paid payment_submissions linked to these applications.
  const paidApplicationIds = new Set<string>();
  if (rows.length) {
    const { data: paidFees } = await sb
      .from("payment_submissions")
      .select("linked_record_id")
      .eq("linked_record_type", "applications")
      .eq("status", "paid")
      .in("linked_record_id", rows.map((a: any) => a.id));
    for (const fee of paidFees ?? []) if (fee.linked_record_id) paidApplicationIds.add(fee.linked_record_id);
  }

  // Certificate-issuance indicator: an approved initial/renewal application
  // with no certifications row pointing back at it yet still needs one.
  const issuedApplicationIds = new Set<string>();
  if (rows.length) {
    const { data: issued } = await sb
      .from("certifications")
      .select("source_application_id")
      .not("source_application_id", "is", null)
      .in("source_application_id", rows.map((a: any) => a.id));
    for (const row of issued ?? []) if (row.source_application_id) issuedApplicationIds.add(row.source_application_id);
  }

  // Testing accommodations requests carry a testing_request_id — resolve the
  // linked exam pre-registration so staff see exactly which exam it is for.
  const linkedTestingRequests = new Map<string, { examCode: string; testingMode: string }>();
  const testingRequestIds = rows.filter((a: any) => a.testing_request_id).map((a: any) => a.testing_request_id);
  if (testingRequestIds.length) {
    const { data: linked } = await sb.from("testing_requests").select("id,exam_code,testing_mode").in("id", testingRequestIds);
    for (const request of linked ?? []) linkedTestingRequests.set(request.id, { examCode: request.exam_code, testingMode: request.testing_mode });
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Applications</h1>
      <p className="mb-6 text-muted">Update certification and recertification application status. Members are emailed on changes.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Cert / request details</th>
              <th className="px-5 py-3">Signed</th><th className="px-5 py-3">Fee</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-muted">No applications.</td></tr>
            ) : rows.map((a: any) => {
              const sync = a.app_type === "cert_sync" ? syncDetails(a.member_notes) : null;
              const digital = digitalDetails(a.member_notes);
              return <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">{digital ? <Link href={`/admin/applications/${a.id}`} className="font-semibold text-brand hover:underline">{[a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || a.profiles?.email || "—"}</Link> : ([a.profiles?.first_name, a.profiles?.last_name].filter(Boolean).join(" ") || a.profiles?.email || "—")}</td>
                <td className="px-5 py-3 text-muted">{title(a.app_type)}</td>
                <td className="px-5 py-3 text-muted">
                  <div>{a.cert_type ?? "—"}</div>
                  {sync && (
                    <div className="mt-1 text-xs">
                      {sync.plan
                        ? <>{sync.plan.items.length} credential(s) → {fmt(sync.plan.targetExpiration)} · {sync.plan.totalMonths} month(s) · ${(sync.plan.totalFeeCents / 100).toFixed(2)}</>
                        : "no computed plan (legacy or paper)"} · {title(sync.submissionMode ?? "digital")}{sync.paperFileName ? ` · ${sync.paperFileName}` : ""}
                    </div>
                  )}
                  {digital && <div className="mt-1 text-xs">{digital.workflowTitle} · {title(digital.submissionMode ?? "digital")} · {digital.documents?.reduce((total, document) => total + (document.annotations?.length ?? 0), 0) ?? 0} mark(s){digital.paperFileName ? ` · ${digital.paperFileName}` : ""}</div>}
                  {a.app_type === "testing_accommodations" && (
                    <div className="mt-1 text-xs">
                      {a.testing_request_id && linkedTestingRequests.has(a.testing_request_id) ? (
                        <Link href={`/admin/testing/${a.testing_request_id}`} className="font-semibold text-brand hover:underline">
                          For: {linkedTestingRequests.get(a.testing_request_id)!.examCode} · {linkedTestingRequests.get(a.testing_request_id)!.testingMode === "remote" ? "Remote" : "In person"} →
                        </Link>
                      ) : (
                        <span className="text-amber-700">Not linked to a pre-registration</span>
                      )}
                    </div>
                  )}
                  {sync?.plan && a.status === "under_review" && <div className="mt-2"><ApplyCertSyncButton applicationId={a.id} /></div>}
                  {["initial", "initial_certification", "renewal"].includes(a.app_type) && a.status === "approved" && a.cert_type && !issuedApplicationIds.has(a.id) && (
                    <Link href={`/admin/members/${a.member_id}#certifications`} className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200">
                      Needs certificate →
                    </Link>
                  )}
                </td>
                <td className="px-5 py-3 text-muted">{a.signature_name ? `✓ ${a.signature_name}` : "—"}</td>
                <td className="px-5 py-3">{!["initial", "renewal", "ceu_workshop", "cert_sync"].includes(a.app_type) ? <span className="text-muted">—</span> : paidApplicationIds.has(a.id) ? <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Fee paid</span> : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Unpaid</span>}</td>
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
