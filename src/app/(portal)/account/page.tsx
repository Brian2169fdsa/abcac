import Link from "next/link";
import { CtaButton } from "@/components/cta-button";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, CeuLike } from "@/lib/ceu-compliance";

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
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}
interface CeuRecord extends CeuLike {
  id: string;
}

function completeness(p: Profile | null): number {
  if (!p) return 0;
  const fields = [p.first_name, p.last_name, p.phone, p.address_line1, p.city, p.state, p.zip_code];
  const filled = fields.filter((f) => f && String(f).trim()).length;
  return Math.round((filled / fields.length) * 100);
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
  let ceuRecords: CeuRecord[] = [];
  let unreadMessages = 0;
  let openDocRequests = 0;
  let backendReady = true;

  if (user) {
    try {
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      profile = p as Profile | null;
      const [
        { data: certs },
        { data: pays },
        { data: ceus },
        { count: msgCount },
        { count: docCount },
      ] = await Promise.all([
        supabase.from("certifications").select("*").eq("member_id", user.id),
        supabase.from("payments").select("*").eq("member_id", user.id).order("created_at", { ascending: false }),
        supabase.from("ceu_records").select("id, hours, category, status").eq("member_id", user.id),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("member_id", user.id).eq("is_read", false),
        supabase.from("document_requests").select("*", { count: "exact", head: true }).eq("member_id", user.id).eq("status", "open"),
      ]);
      certifications = (certs as Certification[]) ?? [];
      payments = (pays as Payment[]) ?? [];
      ceuRecords = (ceus as CeuRecord[]) ?? [];
      unreadMessages = msgCount ?? 0;
      openDocRequests = docCount ?? 0;
    } catch {
      backendReady = false;
    }
  }

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Member";
  const syncOn = certifications.some((c) => c.sync_enabled);
  const profilePct = completeness(profile);
  const isAdmin = (profile as { portal_role?: string | null } | null)?.portal_role === "admin";

  // Action items
  const ceuCompliance = computeCompliance(ceuRecords);
  const ninety = Date.now() + 90 * 86400000;
  const expiringCerts = certifications.filter(
    (c) => c.status === "active" && c.expiration_date !== null && new Date(c.expiration_date).getTime() <= ninety && new Date(c.expiration_date).getTime() > Date.now(),
  );
  // Only nag about CEUs once the member actually holds an active credential to
  // renew — otherwise a brand-new member with no certs sees "40 hours needed."
  const hasActiveCert = certifications.some((c) => c.status === "active");
  const showCeuActionItem = hasActiveCert && !ceuCompliance.compliant;
  const hasActionItems =
    unreadMessages > 0 || openDocRequests > 0 || showCeuActionItem || expiringCerts.length > 0;

  return (
    <>
      <PageHero eyebrow="Member Portal" title={`Welcome, ${displayName}`}>
        <div className="flex gap-4">
          <CtaButton href="/account/certifications" size="sm">My Certifications</CtaButton>
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

      {isAdmin && (
        <Section compact>
          <Link href="/admin" className="flex items-center justify-between rounded-xl border border-brand bg-brand/5 p-5">
            <div>
              <h3 className="text-base">ABCAC Admin Console</h3>
              <p className="mt-1 text-sm text-muted">Review approvals, documents, CEUs, and applications.</p>
            </div>
            <span className="font-semibold text-brand">Open →</span>
          </Link>
        </Section>
      )}

      {/* Action items */}
      {hasActionItems && (
        <Section title="Action Items" compact>
          <div className="flex flex-col gap-3">
            {unreadMessages > 0 && (
              <Link
                href="/account/messages"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {unreadMessages} unread message{unreadMessages !== 1 ? "s" : ""}
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    You have unread messages from ABCAC.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">View →</span>
              </Link>
            )}
            {openDocRequests > 0 && (
              <Link
                href="/account/documents"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    ABCAC requested {openDocRequests} document{openDocRequests !== 1 ? "s" : ""}
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    Please upload the requested document{openDocRequests !== 1 ? "s" : ""} to proceed.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Upload →</span>
              </Link>
            )}
            {showCeuActionItem && (
              <Link
                href="/account/ceus"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {ceuCompliance.remaining} CEU hour{ceuCompliance.remaining !== 1 ? "s" : ""} still needed for renewal
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    You need {ceuCompliance.remaining} more approved CEU hour{ceuCompliance.remaining !== 1 ? "s" : ""} to meet the {40}-hour requirement.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Add CEUs →</span>
              </Link>
            )}
            {expiringCerts.length > 0 && (
              <Link
                href="/account/renewals"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {expiringCerts.length} credential{expiringCerts.length !== 1 ? "s" : ""} expiring within 90 days
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    Renew soon to avoid a lapse in certification status.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Renew →</span>
              </Link>
            )}
          </div>
        </Section>
      )}

      {/* Profile completeness */}
      {profilePct < 100 && (
        <Section compact>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base">Complete your profile</h3>
                <p className="mt-1 text-sm text-muted">A complete profile helps ABCAC process your applications faster.</p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-brand">{profilePct}%</div>
                <Link href="/account/profile" className="text-sm font-semibold text-brand hover:text-brand-600">Finish →</Link>
              </div>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={profilePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completeness"
            >
              <div className="h-full bg-brand" style={{ width: `${profilePct}%` }} />
            </div>
          </div>
        </Section>
      )}

      {/* Quick actions */}
      <Section compact>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/account/applications" className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
            <h3 className="text-base">Application Status</h3>
            <p className="mt-1 text-sm text-muted">Track where your applications stand.</p>
          </Link>
          <Link href="/account/apply" className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
            <h3 className="text-base">Apply for Certification</h3>
            <p className="mt-1 text-sm text-muted">Submit a new application + documents.</p>
          </Link>
          <Link href="/account/renew" className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
            <h3 className="text-base">Submit Recertification</h3>
            <p className="mt-1 text-sm text-muted">Report CEUs and renew your credential.</p>
          </Link>
          <Link href="/account/documents" className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand">
            <h3 className="text-base">Documents</h3>
            <p className="mt-1 text-sm text-muted">Upload and track your paperwork.</p>
          </Link>
        </div>
      </Section>

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
          Manage your <Link href="/account/applications" className="font-semibold text-brand">applications</Link>,{" "}
          <Link href="/account/ceus" className="font-semibold text-brand">CEUs</Link>, and{" "}
          <Link href="/account/documents" className="font-semibold text-brand">documents</Link> from the tabs above.
        </p>
      </Section>
    </>
  );
}
