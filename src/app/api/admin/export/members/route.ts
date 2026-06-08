import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

function escCsv(val: string | null | undefined): string {
  let s = val ?? "";
  // Neutralize spreadsheet formula injection: a leading =, +, -, @, tab, or CR
  // can be interpreted as a formula by Excel/Sheets when the admin opens the CSV.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escCsv).join(",")).join("\n");
}

export async function GET() {
  const sb = createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isAdminRole(profile.portal_role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data } = await sb
    .from("profiles")
    .select("first_name,last_name,email,phone,cert_status,account_status,portal_role,created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    cert_status: string | null;
    account_status: string | null;
    portal_role: string | null;
    created_at: string | null;
  }>;

  const header = ["First Name", "Last Name", "Email", "Phone", "Cert Status", "Account Status", "Role", "Joined"];
  const body = rows.map((p) => [
    p.first_name ?? "",
    p.last_name ?? "",
    p.email ?? "",
    p.phone ?? "",
    p.cert_status ?? "",
    p.account_status ?? "",
    p.portal_role ?? "",
    p.created_at ? p.created_at.slice(0, 10) : "",
  ]);

  const csv = toCsv([header, ...body]);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abcac-members-${today}.csv"`,
    },
  });
}
