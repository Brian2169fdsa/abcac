import { AccountApprovalActions } from "@/components/admin/account-approval-actions";
import { describeLegacyRecord, matchLegacyRecords, type LegacyMemberRecord } from "@/lib/legacy-members";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

export default async function AdminApprovals() {
  const sb = createSupabaseServerClient();
  const { data } = await sb
    .from("profiles")
    .select("*, certifications(cert_type,cert_number,status)")
    .eq("account_status", "pending")
    .not("account_submitted_at", "is", null)
    .order("account_submitted_at", { ascending: true });
  const rows = data ?? [];

  // Legacy roster matching: does this signup correspond to a historical
  // ABCAC record? (Table may not exist until migration 042 runs — degrade.)
  let legacyRecords: LegacyMemberRecord[] = [];
  try {
    const { data: legacy } = await sb
      .from("legacy_members")
      .select("id,first_name,last_name,email,cert_type,cert_number,expiration_date,claimed_by")
      .limit(5000);
    legacyRecords = (legacy ?? []) as LegacyMemberRecord[];
  } catch { /* migration 042 not applied yet */ }

  return (
    <>
      <h1 className="text-2xl font-bold">Account Approvals</h1>
      <p className="mb-6 text-muted">Review and approve new certificate-holder registrations.</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Certifications</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No accounts awaiting approval.</td></tr>
            ) : rows.map((p: any) => {
              const certs = (p.certifications ?? []).filter((c: any) => c.status === "pending")
                .map((c: any) => `${c.cert_type}${c.cert_number ? ` (${c.cert_number})` : ""}`).join(", ") || "—";
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold">{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-5 py-3 text-muted">{p.email}</td>
                  <td className="px-5 py-3 text-muted">{p.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    <div>{certs}</div>
                    {p.submitted_cert_numbers ? (
                      <div className="mt-1 text-xs">
                        <span className="font-semibold">Self-reported #:</span> {p.submitted_cert_numbers}
                      </div>
                    ) : null}
                    {matchLegacyRecords(legacyRecords, { email: p.email, submittedCertNumbers: p.submitted_cert_numbers }).slice(0, 3).map((match) => (
                      <div key={match.record.id} className="mt-1 inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                        Legacy match ({match.matchedBy === "email" ? "email" : "cert #"}): {describeLegacyRecord(match.record)}
                      </div>
                    ))}
                  </td>
                  <td className="px-5 py-3 text-muted">{fmt(p.account_submitted_at)}</td>
                  <td className="px-5 py-3"><AccountApprovalActions memberId={p.id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
