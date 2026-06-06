import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { NameChangeForm, VerificationForm, ReciprocityForm } from "@/components/portal-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export default async function RequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [{ data: profile }, { data: nc }, { data: ver }, { data: rec }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name").eq("id", uid).maybeSingle(),
    supabase.from("name_change_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("verification_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("reciprocity_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
  ]);
  const currentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "";

  const history = (items: { id: string; status: string | null; submitted_at: string | null; label: string }[]) =>
    items.length > 0 && (
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {items.map((i) => <li key={i.id}>{i.label} — <span className="capitalize">{i.status ?? "pending"}</span> · {fmt(i.submitted_at)}</li>)}
      </ul>
    );

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Requests" intro="Submit a name change, request a verification of certification, or start an IC&RC reciprocity transfer." />

      <Section compact title="Name Change">
        <div className="rounded-xl border border-line bg-surface p-6"><NameChangeForm currentName={currentName} /></div>
        {history((nc ?? []).map((r) => ({ id: r.id, status: r.status, submitted_at: r.submitted_at, label: `→ ${r.new_name}` })))}
      </Section>

      <Section compact surface title="Verification of Certification">
        <div className="rounded-xl border border-line bg-surface p-6"><VerificationForm /></div>
        {history((ver ?? []).map((r) => ({ id: r.id, status: r.status, submitted_at: r.submitted_at, label: `${r.purpose} → ${r.recipient_name}` })))}
      </Section>

      <Section compact title="IC&RC Reciprocity">
        <div className="rounded-xl border border-line bg-surface p-6"><ReciprocityForm /></div>
        {history((rec ?? []).map((r) => ({ id: r.id, status: r.status, submitted_at: r.submitted_at, label: `${r.credential ?? "Credential"} → ${r.destination ?? ""}` })))}
      </Section>
    </>
  );
}
