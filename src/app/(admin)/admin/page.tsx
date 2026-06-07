import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(cents: number) { return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }

async function countOf(sb: ReturnType<typeof createSupabaseServerClient>, table: string, build?: (q: any) => any) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count } = await q;
  return count ?? 0;
}

function Tile({ n, label, href, accent }: { n: string | number; label: string; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`rounded-xl border ${accent ? "border-accent/40 bg-accent/5" : "border-line bg-surface"} p-5`}>
      <div className="font-display text-3xl font-bold text-brand">{n}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="block transition-transform hover:-translate-y-0.5">{inner}</Link> : inner;
}

export default async function AdminDashboard() {
  const sb = createSupabaseServerClient();
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 86400000);

  const [members, approvals, docs, ceus, apps, activeCerts, payments, expiring] = await Promise.all([
    countOf(sb, "profiles"),
    countOf(sb, "profiles", (q) => q.eq("account_status", "pending").not("account_submitted_at", "is", null)),
    countOf(sb, "documents", (q) => q.eq("status", "pending")),
    countOf(sb, "ceu_records", (q) => q.eq("status", "pending")),
    countOf(sb, "applications", (q) => q.in("status", ["submitted", "under_review"])),
    countOf(sb, "certifications", (q) => q.eq("status", "active")),
    sb.from("payments").select("amount_cents").eq("status", "paid"),
    sb.from("certifications").select("cert_type,expiration_date,member_id,profiles(first_name,last_name)").eq("status", "active").gte("expiration_date", now.toISOString().slice(0, 10)).lte("expiration_date", in90.toISOString().slice(0, 10)).order("expiration_date", { ascending: true }),
  ]);

  const revenue = (payments.data ?? []).reduce((s: number, p: { amount_cents: number | null }) => s + (p.amount_cents ?? 0), 0);
  const expiringRows = expiring.data ?? [];

  return (
    <>
      <h1 className="page-heading text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-muted">Board overview and items awaiting review.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile n={members} label="Total members" href="/admin/members" />
        <Tile n={approvals} label="Accounts to approve" href="/admin/approvals" accent={approvals > 0} />
        <Tile n={docs} label="Documents pending" href="/admin/documents" accent={docs > 0} />
        <Tile n={ceus} label="CEUs pending" href="/admin/ceus" accent={ceus > 0} />
        <Tile n={apps} label="Applications open" href="/admin/applications" />
        <Tile n={activeCerts} label="Active credentials" />
        <Tile n={expiringRows.length} label="Expiring in 90 days" />
        <Tile n={money(revenue)} label="Revenue collected" />
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3 font-semibold">Credentials expiring within 90 days</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Member</th><th className="px-5 py-3">Credential</th><th className="px-5 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {expiringRows.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-6 text-center text-muted">No credentials expiring soon.</td></tr>
              ) : expiringRows.map((c: any, i: number) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{[c.profiles?.first_name, c.profiles?.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-5 py-3 text-muted">{c.cert_type ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{fmt(c.expiration_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
