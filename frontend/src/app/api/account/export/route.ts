export const runtime = "nodejs";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [
    { data: profile },
    { data: certifications },
    { data: ceu_records },
    { data: documents },
    { data: applications },
    { data: payments },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("certifications").select("*").eq("member_id", user.id),
    supabase.from("ceu_records").select("*").eq("member_id", user.id),
    supabase.from("documents").select("*").eq("member_id", user.id),
    supabase.from("applications").select("*").eq("member_id", user.id),
    supabase.from("payments").select("*").eq("member_id", user.id),
    supabase.from("invoices").select("*").eq("member_id", user.id),
  ]);

  const exportedAt = new Date().toISOString();
  const dateLabel = exportedAt.slice(0, 10); // YYYY-MM-DD

  const payload = {
    exported_at: exportedAt,
    profile: profile ?? null,
    certifications: certifications ?? [],
    ceu_records: ceu_records ?? [],
    documents: documents ?? [],
    applications: applications ?? [],
    payments: payments ?? [],
    invoices: invoices ?? [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="abcac-my-data-${dateLabel}.json"`,
    },
  });
}
