import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CeuSubmitForm } from "@/components/ceu-submit-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "CEU Tracker" };
export const dynamic = "force-dynamic";

const REQUIRED = 40;

interface Ceu {
  id: string; course_name: string | null; provider: string | null; hours: number | null;
  category: string | null; completion_date: string | null; status: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export default async function CeusPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("ceu_records").select("*").eq("member_id", user!.id).order("completion_date", { ascending: false });
  const records = (data as Ceu[]) ?? [];
  const approved = records.filter((r) => r.status === "approved");
  const total = approved.reduce((s, r) => s + Number(r.hours || 0), 0);
  const pct = Math.min(100, Math.round((total / REQUIRED) * 100));
  const byCat = (cat: string) => approved.filter((r) => r.category === cat).reduce((s, r) => s + Number(r.hours || 0), 0);

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Continuing Education Tracker" intro="Log your CEU hours and track progress toward your 40-hour renewal requirement." />
      <Section compact>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="font-display text-3xl font-bold text-brand">{total} / {REQUIRED}</div>
            <div className="mt-1 text-sm text-muted">Approved hours</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="font-display text-3xl font-bold text-brand">{byCat("Ethics")} / 3</div>
            <div className="mt-1 text-sm text-muted">Ethics hours</div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="font-display text-3xl font-bold text-brand">{byCat("Cultural Diversity")} / 3</div>
            <div className="mt-1 text-sm text-muted">Cultural Diversity hours</div>
          </div>
        </div>
        <div className="mt-6"><CeuSubmitForm /></div>
      </Section>

      <Section compact title="Your CEU records">
        {records.length === 0 ? (
          <p className="text-muted">No CEU records yet. Use “Log CEU Hours” above to add your first entry.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Course</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Category</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">{r.course_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.provider ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.hours ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{r.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(r.completion_date)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{r.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
