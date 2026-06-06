import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

interface Credential {
  id: string;
  level: string | null;
  status: string | null;
  expires_at: string | null;
  sync_enabled: boolean | null;
}
interface Payment {
  id: string;
  product_name: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string | null;
}
interface Member {
  id: string;
  full_name: string | null;
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

  let member: Member | null = null;
  let credentials: Credential[] = [];
  let payments: Payment[] = [];
  let backendReady = true;

  if (user) {
    try {
      const { data: m, error } = await supabase.from("members").select("*").eq("auth_user_id", user.id).maybeSingle();
      if (error) throw error;
      member = m as Member | null;
      if (member) {
        const [{ data: creds }, { data: pays }] = await Promise.all([
          supabase.from("credentials").select("*").eq("member_id", member.id),
          supabase.from("payments").select("*").eq("member_id", member.id).order("created_at", { ascending: false }),
        ]);
        credentials = (creds as Credential[]) ?? [];
        payments = (pays as Payment[]) ?? [];
      }
    } catch {
      backendReady = false;
    }
  }

  const displayName = member?.full_name || user?.email || "Member";
  const syncOn = credentials.some((c) => c.sync_enabled);

  return (
    <>
      <PageHero eyebrow="Member Portal" title={`Welcome, ${displayName}`}>
        <Link href="/logout" className="text-sm font-semibold text-brand hover:text-brand-600">Log out</Link>
      </PageHero>

      {!backendReady && (
        <Section compact>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-6 text-muted">
            Your member records aren't connected yet. Once the member database is linked, your credential status and
            payment history will appear here automatically.
          </div>
        </Section>
      )}

      {/* Credentials */}
      <Section title="Your Credentials" compact>
        {credentials.length === 0 ? (
          <p className="text-muted">No credentials on file yet. Start with the certification path that fits you.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {credentials.map((c) => {
              const d = daysLeft(c.expires_at);
              return (
                <div key={c.id} className="rounded-xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg">{c.level ?? "Credential"}</h3>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold capitalize text-muted">
                      {c.status ?? "unknown"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">Expires {fmtDate(c.expires_at)}{d !== null && d > 0 ? ` · ${d} days left` : d !== null ? " · expired" : ""}</p>
                  <CtaButton href={`/store/${RENEWAL_SLUG}`} variant="outline" size="sm" className="mt-4">Renew</CtaButton>
                </div>
              );
            })}
          </div>
        )}
        {credentials.length === 0 && (
          <CtaButton href="/choose-your-cert-path" className="mt-6">Choose Your Cert Path</CtaButton>
        )}
      </Section>

      {/* Certification Sync */}
      <Section surface title="Certification Sync" compact>
        <p className="text-muted">
          {syncOn
            ? "Certification Sync is active on your account."
            : "Align all your renewal dates into one cycle for $15/month."}
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
      </Section>
    </>
  );
}
