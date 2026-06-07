import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CtaButton } from "@/components/cta-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance } from "@/lib/ceu-compliance";
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

  const [{ data: certsData }, { data: ceuData }] = await Promise.all([
    supabase
      .from("certifications")
      .select("*")
      .eq("member_id", user!.id)
      .eq("status", "active"),
    supabase.from("ceu_records").select("*").eq("member_id", user!.id),
  ]);

  const certs: Cert[] = (certsData ?? []).sort((a, b) => {
    const aDate = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
    const bDate = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
    return aDate - bDate;
  });

  const ceuRecords: CeuRecord[] = ceuData ?? [];
  const compliance = computeCompliance(ceuRecords);

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
                {compliance.totalApproved} / 40 approved
              </div>
            </div>
            <div>
              <div className="text-sm text-muted">Ethics</div>
              <div className="mt-1 font-display text-2xl font-bold text-ink">
                {compliance.ethics} / 3
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
                {compliance.cultural} / 3
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
                    const days = daysLeft(c.expiration_date);
                    const isExpired = days !== null && days < 0;
                    const isSoon = days !== null && days >= 0 && days <= 90;
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
