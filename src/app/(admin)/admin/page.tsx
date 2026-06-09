import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOverview, type OverviewStat } from "@/components/admin/admin-overview";
import { AttentionQueue, type AttentionItem } from "@/components/admin/attention-queue";

export const dynamic = "force-dynamic";

type Sb = ReturnType<typeof createSupabaseServerClient>;

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

async function countOf(sb: Sb, table: string, build?: (q: any) => any) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

function nameOf(p: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined): string {
  if (!p) return "—";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return full || p.email || "—";
}

/** How many of the oldest pending items to surface in the attention queue. */
const QUEUE_LIMIT = 8;

export default async function AdminDashboard() {
  const sb = createSupabaseServerClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in60 = new Date(now.getTime() + 60 * 86_400_000).toISOString().slice(0, 10);

  // KPI counts — mirror the layout's queueCounts plus member / expiring stats.
  const [members, approvals, docsPending, ceusPending, ncReq, verReq, recReq, expiringCount] = await Promise.all([
    countOf(sb, "profiles"),
    countOf(sb, "profiles", (q) => q.eq("account_status", "pending").not("account_submitted_at", "is", null)),
    countOf(sb, "documents", (q) => q.eq("status", "pending")),
    countOf(sb, "ceu_records", (q) => q.eq("status", "pending")),
    countOf(sb, "name_change_requests", (q) => q.eq("status", "pending")),
    countOf(sb, "verification_requests", (q) => q.eq("status", "pending")),
    countOf(sb, "reciprocity_requests", (q) => q.eq("status", "pending")),
    countOf(sb, "certifications", (q) =>
      q.eq("status", "active").gte("expiration_date", today).lte("expiration_date", in60),
    ),
  ]);

  const openRequests = ncReq + verReq + recReq;

  const stats: OverviewStat[] = [
    { label: "Total members", value: members, href: "/admin/members" },
    { label: "Pending approvals", value: approvals, href: "/admin/approvals", attention: approvals > 0 },
    { label: "Documents pending", value: docsPending, href: "/admin/documents", attention: docsPending > 0 },
    { label: "CEU reviews", value: ceusPending, href: "/admin/ceus", attention: ceusPending > 0 },
    { label: "Open requests", value: openRequests, href: "/admin/requests", attention: openRequests > 0 },
    { label: "Certs expiring (60d)", value: expiringCount, href: "/admin/compliance" },
  ];

  // Pull a handful of the oldest pending items from each queue, then merge &
  // sort by age so the most overdue work bubbles to the top.
  const [approvalRows, docRows, ceuRows, ncRows, verRows, recRows, expiring] = await Promise.all([
    sb
      .from("profiles")
      .select("id,first_name,last_name,email,account_submitted_at")
      .eq("account_status", "pending")
      .not("account_submitted_at", "is", null)
      .order("account_submitted_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("documents")
      .select("id,document_type,uploaded_at,profiles(first_name,last_name,email)")
      .eq("status", "pending")
      .order("uploaded_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("ceu_records")
      .select("id,course_name,submitted_at,profiles(first_name,last_name,email)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("name_change_requests")
      .select("id,new_name,submitted_at,profiles(first_name,last_name,email)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("verification_requests")
      .select("id,purpose,submitted_at,profiles(first_name,last_name,email)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("reciprocity_requests")
      .select("id,direction,credential,submitted_at,profiles(first_name,last_name,email)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(QUEUE_LIMIT),
    sb
      .from("certifications")
      .select("cert_type,expiration_date,member_id,profiles(first_name,last_name)")
      .eq("status", "active")
      .gte("expiration_date", today)
      .lte("expiration_date", in60)
      .order("expiration_date", { ascending: true })
      .limit(20),
  ]);

  const items: AttentionItem[] = [];

  for (const r of (approvalRows.data ?? []) as any[]) {
    items.push({
      id: `approval-${r.id}`,
      kind: "Approval",
      who: nameOf(r),
      what: "Account awaiting approval",
      since: r.account_submitted_at,
      href: "/admin/approvals",
    });
  }
  for (const r of (docRows.data ?? []) as any[]) {
    items.push({
      id: `doc-${r.id}`,
      kind: "Document",
      who: nameOf(r.profiles),
      what: r.document_type ? `Document: ${r.document_type}` : "Document review",
      since: r.uploaded_at,
      href: "/admin/documents",
    });
  }
  for (const r of (ceuRows.data ?? []) as any[]) {
    items.push({
      id: `ceu-${r.id}`,
      kind: "CEU",
      who: nameOf(r.profiles),
      what: r.course_name ? `CEU: ${r.course_name}` : "CEU review",
      since: r.submitted_at,
      href: "/admin/ceus",
    });
  }
  for (const r of (ncRows.data ?? []) as any[]) {
    items.push({
      id: `nc-${r.id}`,
      kind: "Request",
      who: nameOf(r.profiles),
      what: r.new_name ? `Name change → ${r.new_name}` : "Name change request",
      since: r.submitted_at,
      href: "/admin/requests",
    });
  }
  for (const r of (verRows.data ?? []) as any[]) {
    items.push({
      id: `ver-${r.id}`,
      kind: "Request",
      who: nameOf(r.profiles),
      what: r.purpose ? `Verification: ${r.purpose}` : "Verification request",
      since: r.submitted_at,
      href: "/admin/requests",
    });
  }
  for (const r of (recRows.data ?? []) as any[]) {
    items.push({
      id: `rec-${r.id}`,
      kind: "Request",
      who: nameOf(r.profiles),
      what: r.credential ? `Reciprocity: ${r.credential}` : "Reciprocity request",
      since: r.submitted_at,
      href: "/admin/requests",
    });
  }

  const queue = items
    .filter((i) => i.since)
    .sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime())
    .slice(0, QUEUE_LIMIT);

  const expiringRows = (expiring.data ?? []) as any[];

  return (
    <>
      <h1 className="text-2xl font-bold">Command center</h1>
      <p className="mb-6 text-muted">At a glance — what needs attention across all members.</p>

      <AdminOverview stats={stats} />

      <div className="mt-8">
        <AttentionQueue items={queue} />
      </div>

      <div className="mt-8 rounded-xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-5 py-3 font-semibold">Credentials expiring within 60 days</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Credential</th>
                <th className="px-5 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {expiringRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-muted">
                    No credentials expiring soon.
                  </td>
                </tr>
              ) : (
                expiringRows.map((c, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">{nameOf(c.profiles)}</td>
                    <td className="px-5 py-3 text-muted">{c.cert_type ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{fmt(c.expiration_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-sm">
        <Link href="/admin/reports" className="font-semibold text-brand hover:text-brand-600">
          View full reports →
        </Link>
      </div>
    </>
  );
}
