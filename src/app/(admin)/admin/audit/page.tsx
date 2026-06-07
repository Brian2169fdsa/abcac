import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AuditProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AuditRow {
  id: string;
  admin_id: string | null;
  action: string | null;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
  profiles: AuditProfile | AuditProfile[] | null;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProfile(profiles: AuditProfile | AuditProfile[] | null): AuditProfile | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

function adminLabel(profiles: AuditProfile | AuditProfile[] | null): string {
  const p = getProfile(profiles);
  if (!p) return "—";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  if (name && p.email) return `${name} (${p.email})`;
  return name || p.email || "—";
}

function targetLabel(row: AuditRow): string {
  const parts: string[] = [];
  if (row.target_table) parts.push(row.target_table);
  if (row.target_id) parts.push(row.target_id.slice(0, 8) + "…");
  return parts.join(" / ") || "—";
}

function detailsLabel(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  const str = JSON.stringify(details);
  return str.length > 120 ? str.slice(0, 117) + "…" : str;
}

export default async function AdminAuditPage() {
  const sb = createSupabaseServerClient();
  const { data, error } = await sb
    .from("admin_audit_log")
    .select("*, profiles(first_name,last_name,email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: AuditRow[] = (data as AuditRow[] | null) ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="mb-6 text-muted">
        Latest 200 admin actions. Written automatically on every admin mutation.
      </p>
      {error && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error loading audit log: {error.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Admin</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Target</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{fmt(row.created_at)}</td>
                  <td className="px-5 py-3">{adminLabel(row.profiles)}</td>
                  <td className="px-5 py-3 font-semibold">{row.action ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{targetLabel(row)}</td>
                  <td className="max-w-xs truncate px-5 py-3 font-mono text-xs text-muted">
                    {detailsLabel(row.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
