import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CertificateActions } from "@/components/certificate-actions";
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

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Certificates & Wallet Cards" intro="Download your official certificate and wallet card for any active credential." />
      <Section compact>
        {rows.length === 0 ? (
          <p className="text-muted">No certifications issued yet. Once ABCAC approves your application, your credential will appear here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Certification</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Download</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{c.cert_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.cert_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.issued_date)}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.expiration_date)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{c.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.status === "active" ? <CertificateActions cert={c} memberName={memberName} /> : <span className="text-muted">—</span>}
                    </td>
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
