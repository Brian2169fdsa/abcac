import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, CeuLike } from "@/lib/ceu-compliance";

export const dynamic = "force-dynamic";

interface CertRow {
  member_id: string;
}

interface CeuRow {
  member_id: string;
  hours: number | null;
  category: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export default async function AdminCompliancePage() {
  const sb = createSupabaseServerClient();

  // Fetch active certifications, approved CEU records, and relevant profiles in parallel
  const [certsRes, ceusRes] = await Promise.all([
    sb
      .from("certifications")
      .select("member_id")
      .eq("status", "active"),
    sb
      .from("ceu_records")
      .select("member_id, hours, category")
      .eq("status", "approved"),
  ]);

  const certRows = (certsRes.data ?? []) as CertRow[];
  const ceuRows = (ceusRes.data ?? []) as CeuRow[];

  // Unique member IDs that have at least one active certification
  const activeMemberIds = Array.from(new Set(certRows.map((c) => c.member_id)));

  // Fetch profiles for those members only
  let profileRows: ProfileRow[] = [];
  if (activeMemberIds.length > 0) {
    const { data } = await sb
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", activeMemberIds);
    profileRows = (data ?? []) as ProfileRow[];
  }

  // Group CEU records by member_id
  const ceuByMember = ceuRows.reduce<Record<string, CeuLike[]>>((acc, row) => {
    if (!acc[row.member_id]) acc[row.member_id] = [];
    // These records are already approved; pass status through so computeCompliance counts them
    acc[row.member_id].push({ hours: row.hours, category: row.category, status: "approved" });
    return acc;
  }, {});

  // Compute compliance per member
  const rows = profileRows.map((p) => {
    const records = ceuByMember[p.id] ?? [];
    const comp = computeCompliance(records);
    return { profile: p, comp };
  });

  // Sort: Behind first, then Compliant
  rows.sort((a, b) => {
    if (a.comp.compliant === b.comp.compliant) return 0;
    return a.comp.compliant ? 1 : -1;
  });

  return (
    <>
      <h1 className="text-2xl font-bold">CEU Compliance</h1>
      <p className="mb-6 text-muted">
        Renewal compliance status for all members with an active certification. Requires 40 total
        approved hours, including 3 in Ethics and 3 in Cultural Diversity.
      </p>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Member</th>
              <th className="px-5 py-3">Approved hrs</th>
              <th className="px-5 py-3">Ethics</th>
              <th className="px-5 py-3">Cultural Diversity</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No members with active certifications found.
                </td>
              </tr>
            ) : (
              rows.map(({ profile, comp }) => {
                const name =
                  [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                  profile.email ||
                  "—";
                return (
                  <tr key={profile.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold">
                      <div>{name}</div>
                      <div className="text-xs text-muted">{profile.email}</div>
                    </td>
                    <td className="px-5 py-3 text-muted">{comp.totalApproved} / 40</td>
                    <td className="px-5 py-3 text-muted">{comp.ethics} / 3</td>
                    <td className="px-5 py-3 text-muted">{comp.cultural} / 3</td>
                    <td className="px-5 py-3">
                      {comp.compliant ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          Behind
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
