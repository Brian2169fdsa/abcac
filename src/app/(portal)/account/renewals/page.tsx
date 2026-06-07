import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CtaButton } from "@/components/cta-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, requirementsFromSchedule } from "@/lib/ceu-compliance";
import {
  type CertSchedule,
  findScheduleFor,
  computeDueFromExpiration,
} from "@/lib/schedules";
import Link from "next/link";

export const metadata = { title: "Renewals" };
export const dynamic = "force-dynamic";

interface Cert {
  id: string;
  member_id: string;
  cert_type: string | null;
  cert_number: string | null;
  status: string | null;
  expiration_date: string | null;
  sync_enabled: boolean | null;
}

interface CeuRecord {
  id: string;
  member_id: string;
  hours: number | null;
  category: string | null;
  status: string | null;
}

function fmt(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

function daysLeft(expiration: string | null): number | null {
  if (!expiration) return null;
  const exp = new Date(expiration).getTime();
  const now = Date.now();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export default async function RenewalsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: certsData }, { data: ceuData }, { data: scheduleData }] = await Promise.all([
    supabase
      .from("certifications")
      .select("*")
      .eq("member_id", user!.id)
      .eq("status", "active"),
    supabase.from("ceu_records").select("*").eq("member_id", user!.id),
    // Reference rules — read-only to any authenticated member. Degrade gracefully
    // if the table/rows are absent (falls back to the 90-day / 40-CEU defaults).
    supabase
      .from("cert_schedules")
      .select(
        "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
      ),
  ]);

  const certs: Cert[] = (certsData ?? []).sort((a, b) => {
    const aDate = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
    const bDate = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
    return aDate - bDate;
  });

  const schedules: CertSchedule[] = (scheduleData as CertSchedule[]) ?? [];

  const ceuRecords: CeuRecord[] = ceuData ?? [];
  // CEU readiness is shown against the soonest-expiring active credential's
  // schedule when known; otherwise the 40/3/3 default applies.
  const primaryCredential = certs[0]?.cert_type ?? null;
  const primarySchedule = findScheduleFor(schedules, primaryCredential);
  const compliance = computeCompliance(ceuRecords, requirementsFromSchedule(primarySchedule));

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Renewals"
        intro="Track your active credentials and CEU readiness for renewal."
      />

      <Section compact>
        {/* CEU Readiness Card */}
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">CEU readiness for renewal</h2>
            {compliance.compliant ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Compliant
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Not yet compliant
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted">Hours remaining</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">
                {compliance.remaining}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {compliance.totalApproved} / {compliance.requiredTotal} approved
              </div>
            </div>
            <div>
              <div className="text-sm text-muted">Ethics</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">
                {compliance.ethics} / {compliance.requiredEthics}
              </div>
              {compliance.ethicsRemaining > 0 && (
                <div className="mt-0.5 text-xs text-amber-600">
                  {compliance.ethicsRemaining} hr{compliance.ethicsRemaining !== 1 ? "s" : ""} needed
                </div>
              )}
            </div>
            <div>
              <div className="text-sm text-muted">Cultural Diversity</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">
                {compliance.cultural} / {compliance.requiredCultural}
              </div>
              {compliance.culturalRemaining > 0 && (
                <div className="mt-0.5 text-xs text-amber-600">
                  {compliance.culturalRemaining} hr{compliance.culturalRemaining !== 1 ? "s" : ""} needed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Certifications Table */}
        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold">Active certifications</h2>
          {certs.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-8 text-center">
              <p className="text-muted">You have no active certifications at this time.</p>
              <p className="mt-2 text-sm text-muted">
                Ready to get certified?{" "}
                <Link href="/account/apply" className="font-semibold text-brand hover:underline">
                  Start an application
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Certification</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3">Days left</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => {
                    // Prefer the schedule engine (grace-aware) when this credential
                    // has a cert_schedules row AND a known expiration date; otherwise
                    // fall back to the prior raw days-until-expiry behavior.
                    const schedule = findScheduleFor(schedules, c.cert_type);
                    const due =
                      schedule && c.expiration_date
                        ? computeDueFromExpiration(schedule, c.expiration_date)
                        : null;
                    const days = due ? due.daysUntilDue : daysLeft(c.expiration_date);
                    // Past due date but still inside grace = treat as "soon"/amber,
                    // only flag Expired once the grace window has fully lapsed.
                    const isExpired = due
                      ? due.lapsed
                      : days !== null && days < 0;
                    const isSoon = due
                      ? !due.lapsed && days !== null && days <= 90
                      : days !== null && days >= 0 && days <= 90;
                    return (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold text-ink">{c.cert_type ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">{c.cert_number ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">{fmt(c.expiration_date)}</td>
                        <td className="px-4 py-3">
                          {days === null ? (
                            <span className="text-muted">—</span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              Expired
                            </span>
                          ) : due?.inGracePeriod ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              In grace
                            </span>
                          ) : isSoon ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              {days}d
                            </span>
                          ) : (
                            <span className="text-muted">{days}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CtaButton
                              href="/store/certification-renewal-2-year-credential-renewal-fee"
                              size="sm"
                            >
                              Renew
                            </CtaButton>
                            <Link
                              href="/account/renew"
                              className="text-xs font-semibold text-brand hover:underline"
                            >
                              Submit recertification
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
