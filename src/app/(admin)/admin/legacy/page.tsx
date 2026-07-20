import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

// Imported historical member roster: verify signups against it, track the
// invite campaign, and see who has claimed their portal account.
export default async function AdminLegacyMembers({ searchParams }: { searchParams: { q?: string } }) {
  const sb = createSupabaseServerClient();
  const q = (searchParams.q ?? "").trim();

  let rows: any[] = [];
  let total = 0;
  let active = 0;
  let invited = 0;
  let claimed = 0;
  let tableMissing = false;
  try {
    let query = sb
      .from("legacy_members")
      .select("id,first_name,last_name,email,cert_type,cert_number,expiration_date,status,invited_at,claimed_by,claimed_at,import_batch")
      .order("last_name", { ascending: true })
      .limit(200);
    if (q) query = query.or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%,cert_number.ilike.%${q}%`);
    const [{ data, error }, totals, activeCount, invitedCount, claimedCount] = await Promise.all([
      query,
      sb.from("legacy_members").select("*", { count: "exact", head: true }),
      sb.from("legacy_members").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("legacy_members").select("*", { count: "exact", head: true }).not("invited_at", "is", null),
      sb.from("legacy_members").select("*", { count: "exact", head: true }).not("claimed_by", "is", null),
    ]);
    if (error) throw error;
    rows = data ?? [];
    total = totals.count ?? 0;
    active = activeCount.count ?? 0;
    invited = invitedCount.count ?? 0;
    claimed = claimedCount.count ?? 0;
  } catch {
    tableMissing = true;
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Legacy Member Records</h1>
      <p className="mb-6 text-muted">
        The imported historical roster. Signups are matched against it on the Approvals queue; the invite scripts
        drive the portal claim campaign from here.
      </p>

      {tableMissing ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          The legacy roster is not set up yet. Apply migration <code>042_legacy_members.sql</code>, then load the
          historical database with <code>npx tsx scripts/import-legacy-members.ts members.csv</code>.
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            {[["Records imported", total], ["Active standing", active], ["Invited to portal", invited], ["Accounts created", claimed]].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
                <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>

          <form className="mb-4" action="/admin/legacy" method="get">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, or cert number…"
              className="h-11 w-full max-w-md rounded-lg border border-line bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </form>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Credential</th>
                  <th className="px-5 py-3">Standing</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Invited</th><th className="px-5 py-3">Account</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-muted">{q ? "No records match that search." : "No records imported yet."}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-5 py-3 text-muted">{r.email ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{[r.cert_type, r.cert_number ? `#${r.cert_number}` : null].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-5 py-3">{r.status === "active"
                      ? <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
                      : r.status === "review"
                        ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Review</span>
                        : <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-muted">Inactive</span>}</td>
                    <td className="px-5 py-3 text-muted">{fmt(r.expiration_date)}</td>
                    <td className="px-5 py-3 text-muted">{r.invited_at ? fmt(r.invited_at) : "—"}</td>
                    <td className="px-5 py-3">{r.claimed_by
                      ? <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Created</span>
                      : <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-muted">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
