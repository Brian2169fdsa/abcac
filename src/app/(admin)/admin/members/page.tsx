import { IssueCertForm } from "@/components/admin/issue-cert-form";
import { MemberListFilters } from "@/components/admin/member-list-filters";
import { MemberListTable, type MemberRow } from "@/components/admin/member-list-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  role?: string;
}

export default async function AdminMembers({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim();
  const role = (sp.role ?? "").trim();

  const sb = createSupabaseServerClient();
  let query = sb.from("profiles").select("*").order("created_at", { ascending: false });

  if (q) {
    const term = q.replace(/[%,]/g, "");
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }
  if (status) query = query.eq("account_status", status);
  if (role) query = query.eq("portal_role", role);

  const { data } = await query;
  const rows = data ?? [];

  const members: MemberRow[] = rows.map((p: any) => ({
    id: p.id as string,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    email: p.email ?? null,
    cert_status: p.cert_status ?? null,
    account_status: p.account_status ?? null,
    portal_role: p.portal_role ?? null,
  }));

  // Cert-issuing dropdown should reflect every member, not the filtered view.
  const { data: allProfiles } = await sb
    .from("profiles")
    .select("id,first_name,last_name,email")
    .order("created_at", { ascending: false });

  const memberOptions = (allProfiles ?? []).map((p: any) => ({
    id: p.id as string,
    label: [
      [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      p.email ? `(${p.email})` : null,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return (
    <>
      <h1 className="text-2xl font-bold">Members</h1>
      <p className="mb-6 text-muted">
        Directory of all member accounts. Search, filter, open a member, or adjust
        account status and role inline.
      </p>

      <h2 className="mb-3 text-lg font-semibold">Issue a certification</h2>
      <div className="mb-8">
        <IssueCertForm members={memberOptions} />
      </div>

      <MemberListFilters />
      <MemberListTable members={members} />
    </>
  );
}
