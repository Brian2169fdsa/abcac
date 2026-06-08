import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CeuSubmitForm } from "@/components/ceu-submit-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, requirementsFromSchedule } from "@/lib/ceu-compliance";
import { type CertSchedule, findScheduleFor } from "@/lib/schedules";

export const metadata = { title: "CEU Tracker" };
export const dynamic = "force-dynamic";

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
  const [{ data }, { data: certData }, { data: scheduleData }] = await Promise.all([
    supabase.from("ceu_records").select("*").eq("member_id", user!.id).order("completion_date", { ascending: false }),
    supabase.from("certifications").select("cert_type, expiration_date, status").eq("member_id", user!.id).eq("status", "active"),
    supabase
      .from("cert_schedules")
      .select("credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes"),
  ]);
  const records = (data as Ceu[]) ?? [];
  const activeCerts = (certData as { cert_type: string | null; expiration_date: string | null }[]) ?? [];
  const schedules = (scheduleData as CertSchedule[]) ?? [];
  // Use the soonest-expiring active credential's schedule when known.
  const primaryCert = activeCerts
    .slice()
    .sort((a, b) => {
      const aD = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
      const bD = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
      return aD - bD;
    })[0];
  const requirements = requirementsFromSchedule(findScheduleFor(schedules, primaryCert?.cert_type));
  const REQUIRED = requirements.total;
  const approved = records.filter((r) => r.status === "approved");
  const total = approved.reduce((s, r) => s + Number(r.hours || 0), 0);
  const pct = Math.min(100, Math.round((total / REQUIRED) * 100));
  const byCat = (cat: string) => approved.filter((r) => r.category === cat).reduce((s, r) => s + Number(r.hours || 0), 0);
  const ethics = byCat("Ethics");
  const cultural = byCat("Cultural Diversity");
  const ethicsPct = requirements.ethics > 0 ? Math.min(100, Math.round((ethics / requirements.ethics) * 100)) : 100;
  const culturalPct = requirements.cultural > 0 ? Math.min(100, Math.round((cultural / requirements.cultural) * 100)) : 100;
  const compliance = computeCompliance(records, requirements);

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Continuing Education Unit Tracker" intro={`Log your CEU hours and track progress toward your ${REQUIRED}-hour renewal requirement.`} />
      <Section compact>
        <div className="mb-6 flex items-start gap-4 rounded-xl border border-info/20 bg-info/5 px-5 py-4">
          <span className="shrink-0 rounded bg-info px-3 py-1 text-xs font-semibold text-white">Note</span>
          <p className="text-sm text-ink">
            Recertification requires <strong>{REQUIRED} CEU hours</strong> per renewal cycle, including{" "}
            <strong>{requirements.ethics} hrs Ethics</strong> and <strong>{requirements.cultural} hrs Cultural Diversity</strong>.
            All training must be specifically related to substance abuse.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total Completed</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{total} / {REQUIRED}</div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={total} aria-valuemin={0} aria-valuemax={REQUIRED} aria-label="Approved CEU hours toward renewal"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
            <div className="mt-2 text-sm text-muted">{pct}%</div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Ethics</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{ethics} / {requirements.ethics}</div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={ethics} aria-valuemin={0} aria-valuemax={requirements.ethics} aria-label="Ethics CEU hours"><div className="h-full bg-success" style={{ width: `${ethicsPct}%` }} /></div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Cultural Diversity</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{cultural} / {requirements.cultural}</div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={cultural} aria-valuemin={0} aria-valuemax={requirements.cultural} aria-label="Cultural Diversity CEU hours"><div className="h-full bg-accent" style={{ width: `${culturalPct}%` }} /></div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Hours Remaining</div>
            <div className="mt-1 font-display text-3xl font-bold text-brand">{compliance.remaining}</div>
            <div className="mt-2 text-sm text-muted">hours remaining</div>
          </div>
        </div>
        {/* Renewal Compliance Card */}
        <div className="mt-5 rounded-xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">Renewal compliance</h2>
            {compliance.compliant ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Compliant</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Not yet</span>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted">Hours remaining</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">{compliance.remaining}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Ethics</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">{compliance.ethics} / {compliance.requiredEthics}</div>
              {compliance.ethicsRemaining > 0 && (
                <div className="mt-0.5 text-xs text-amber-600">{compliance.ethicsRemaining} hr{compliance.ethicsRemaining !== 1 ? "s" : ""} needed</div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted">Cultural Diversity</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">{compliance.cultural} / {compliance.requiredCultural}</div>
              {compliance.culturalRemaining > 0 && (
                <div className="mt-0.5 text-xs text-amber-600">{compliance.culturalRemaining} hr{compliance.culturalRemaining !== 1 ? "s" : ""} needed</div>
              )}
            </div>
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
