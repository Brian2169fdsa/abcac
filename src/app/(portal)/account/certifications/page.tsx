import Link from "next/link";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CertificateActions } from "@/components/certificate-actions";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Certifications" };
export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export default async function CertificationsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: certs }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name").eq("id", user!.id).maybeSingle(),
    supabase.from("certifications").select("*").eq("member_id", user!.id).order("issued_date", { ascending: false }),
  ]);
  const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
  const rows = certs ?? [];
  const hasActive = rows.some((c) => c.status === "active");

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Certificate & Wallet Card" intro="Download your official certificate and wallet card for any active credential." />
      <Section compact>
        {hasActive && (
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <span className="shrink-0 rounded bg-success px-3 py-1 text-xs font-semibold text-white">Active</span>
            <p className="text-sm text-green-900">
              Your certifications are in good standing. You may download your certificate and wallet card below.
            </p>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="text-muted">No certifications issued yet. Once ABCAC approves your application, your credential will appear here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <h2 className="px-4 pt-4 text-base font-semibold text-ink">Issued Certificates</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Certification</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Date Issued</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">IC&amp;RC Level</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{c.cert_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.cert_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.issued_date)}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.expiration_date)}</td>
                    <td className="px-4 py-3 text-muted">{c.ic_rc_level ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.status === "active" ? <CertificateActions cert={c} memberName={memberName} /> : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">IC&amp;RC International Certificate</h2>
          <p className="mt-2 text-sm text-muted">
            If you hold a reciprocal-level ABCAC credential, you may order an IC&amp;RC International Certificate — a
            globally recognized endorsement of your certification.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/store" className={buttonVariants({ variant: "accent", size: "sm" })}>
              Order IC&amp;RC International Certificate
            </Link>
            <Link href="/account/requests" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Start a Reciprocity Transfer
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
