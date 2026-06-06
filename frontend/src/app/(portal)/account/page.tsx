import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

interface Certification {
  id: string;
  cert_type: string | null;
  cert_number: string | null;
  status: string | null;
  expiration_date: string | null;
  sync_enabled: boolean | null;
}
interface Payment {
  id: string;
  product_name: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string | null;
}
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

const RENEWAL_SLUG = "certification-renewal-2-year-credential-renewal-fee";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function daysLeft(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function money(cents: number | null) {
  return "$" + ((cents ?? 0) / 100).toFixed(2);
}

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let certifications: Certification[] = [];
  let payments: Payment[] = [];
  let backendReady = true;

  if (user) {
    try {
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      profile = p as Profile | null;
      const [{ data: certs }, { data: pays }] = await Promise.all([
        supabase.from("certifications").select("*").eq("member_id", user.id),
        supabase.from("payments").select("*").eq("member_id", user.id).order("created_at", { ascending: false }),
      ]);
      certifications = (certs as Certification[]) ?? [];
      payments = (pays as Payment[]) ?? [];
    } catch {
      backendReady = false;
    }
  }

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Member";
  const syncOn = certifications.some((c) => c.sync_enabled);

  return (
    <>
      <PageHero eyebrow="Member Portal" title={`Welcome, ${displayName}`}>
        <div className="flex gap-4">
          <CtaButton href="/portal" size="sm">Open Full Portal</CtaButton>
          <Link href="/logout" className="self-center text-sm font-semibold text-brand hover:text-brand-600">Log out</Link>
        </div>
      </PageHero>

      {!backendReady && (
        <Section compact>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-6 text-muted">
            We couldn't load your records just now. Please refresh, or open the full portal.
          </div>
        </Section>
      )}

      {/* Credentials */}
      <Section title="Your Credentials" compact>
        {certifications.length === 0 ? (
          <p className="text-muted">No credentials on file yet. Start with the certification path that fits you.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {certifications.map((c) => {
              const d = daysLeft(c.expiration_date);
              return (
                <div key={c.id} className="rounded-xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg">{c.cert_type ?? "Credential"}</h3>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold capitalize text-muted">
                      {c.status ?? "unknown"}
                    </span>
                  </div>
                  {c.cert_number && <p className="mt-1 text-sm text-muted">No. {c.cert_number}</p>}
                  <p className="mt-2 text-sm text-muted">
                    Expires {fmtDate(c.expiration_date)}
                    {d !== null && d > 0 ? ` · ${d} days left` : d !== null ? " · expired" : ""}
                  </p>
                  <CtaButton href={`/store/${RENEWAL_SLUG}`} variant="outline" size="sm" className="mt-4">Renew</CtaButton>
                </div>
              );
            })}
          </div>
        )}
        {certifications.length === 0 && (
          <CtaButton href="/choose-your-cert-path" className="mt-6">Choose Your Cert Path</CtaButton>
        )}
      </Section>

      {/* Certification Sync */}
      <Section surface title="Certification Sync" compact>
        <p className="text-muted">
          {syncOn ? "Certification Sync is active on your account." : "Align all your renewal dates into one cycle for $15/month."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {syncOn ? (
            <CtaButton href="/api/stripe/portal" variant="outline">Manage Subscription</CtaButton>
          ) : (
            <CtaButton href="/store/certification-sync" variant="accent">Start Certification Sync</CtaButton>
          )}
        </div>
      </Section>

      {/* Payment history */}
      <Section title="Payment History" compact>
        {payments.length === 0 ? (
          <p className="text-muted">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-muted">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3">{p.product_name ?? "—"}</td>
                    <td className="px-4 py-3">{money(p.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{p.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          Manage applications, CEUs, and documents in the{" "}
          <Link href="/portal" className="font-semibold text-brand">full member portal</Link>.
        </p>
      </Section>
    </>
  );
}
