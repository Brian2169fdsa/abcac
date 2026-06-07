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

  const { data } = await sb
    .from("payments")
    .select("created_at,product_name,amount_cents,currency,status,slug")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    created_at: string | null;
    product_name: string | null;
    amount_cents: number | null;
    currency: string | null;
    status: string | null;
    slug: string | null;
  }>;

  const header = ["Date", "Product", "Amount", "Currency", "Status", "Slug"];
  const body = rows.map((p) => {
    const dollars = p.amount_cents != null ? (p.amount_cents / 100).toFixed(2) : "";
    return [
      p.created_at ? p.created_at.slice(0, 10) : "",
      p.product_name ?? "",
      dollars,
      p.currency ?? "",
      p.status ?? "",
      p.slug ?? "",
    ];
  });

  const csv = toCsv([header, ...body]);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abcac-payments-${today}.csv"`,
    },
  });
}
