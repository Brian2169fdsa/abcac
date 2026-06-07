import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  if (!profile || profile.portal_role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 86400000);
  const today = now.toISOString().slice(0, 10);
  const cutoff = in90.toISOString().slice(0, 10);

  const { data } = await sb
    .from("certifications")
    .select("cert_type,cert_number,expiration_date,profiles(first_name,last_name)")
    .eq("status", "active")
    .gte("expiration_date", today)
    .lte("expiration_date", cutoff)
    .order("expiration_date", { ascending: true });

  const rows = (data ?? []) as unknown as Array<{
    cert_type: string | null;
    cert_number: string | null;
    expiration_date: string | null;
    profiles: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
  }>;

  const header = ["Member", "Credential", "Number", "Expires"];
  const body = rows.map((c) => {
    const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const memberName = [prof?.first_name, prof?.last_name]
      .filter(Boolean)
      .join(" ") || "";
    return [
      memberName,
      c.cert_type ?? "",
      c.cert_number ?? "",
      c.expiration_date ?? "",
    ];
  });

  const csv = toCsv([header, ...body]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abcac-expiring-${today}.csv"`,
    },
  });
}
