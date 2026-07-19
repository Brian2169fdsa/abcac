import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCents, formatDateTimeWithYear } from "@/lib/format";
import {
  buildRenewalPipeline,
  STAGE_META,
  type CertInput,
  type InvoiceInput,
  type ProfileInput,
  type RenewalStage,
} from "@/lib/renewals";
import {
  parseStageFilter,
  rowsForStage,
  stageTabs,
  urgencyColorClass,
  relativeDays,
} from "./helpers";

export const dynamic = "force-dynamic";

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="font-display text-3xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: RenewalStage }) {
  const meta = STAGE_META[stage];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminRenewalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter = parseStageFilter(searchParams.stage);

  const sb = createSupabaseServerClient();

  const [certsData, invoicesData, profilesData, renewalPaymentsData] = await Promise.all([
    sb
      .from("certifications")
      .select("member_id,cert_type,cert_number,status,expiration_date"),
    sb
      .from("invoices")
      .select("member_id,invoice_number,description,amount_cents,status,created_at"),
    sb.from("profiles").select("id,first_name,last_name,email"),
    // Self-serve renewal fees paid via portal checkout (webhook-written) — fold
    // them into the pipeline as paid renewal "invoices" so members who paid
    // online advance to paid-processing without a manually issued invoice.
    sb
      .from("payments")
      .select("member_id,product_name,amount_cents,status,created_at")
      .eq("slug", "certification-renewal-2-year-credential-renewal-fee")
      .eq("status", "paid"),
  ]);

  const certs = (certsData.data ?? []) as CertInput[];
  const selfServeRenewals: InvoiceInput[] = (renewalPaymentsData.data ?? []).map((payment: any) => ({
    member_id: payment.member_id,
    invoice_number: "Stripe checkout",
    description: payment.product_name ?? "Certification renewal fee",
    amount_cents: payment.amount_cents,
    status: "paid",
    created_at: payment.created_at,
  }));
  const invoices = [...((invoicesData.data ?? []) as InvoiceInput[]), ...selfServeRenewals];
  const profiles = (profilesData.data ?? []) as ProfileInput[];

  const pipeline = buildRenewalPipeline(certs, invoices, profiles);
  const { counts, outstandingCents, collectedCents } = pipeline;

  const rows = rowsForStage(pipeline, filter);
  const tabs = stageTabs(pipeline);

  return (
    <>
      <h1 className="text-2xl font-bold">Renewals Pipeline</h1>
      <p className="mb-6 text-muted">
        The credential-continuity lifecycle: an active credential nears expiration
        (<span className="font-medium">upcoming</span>), a renewal invoice is issued
        (<span className="font-medium">invoiced</span>), the member pays
        (<span className="font-medium">paid — processing</span>), and the credential is
        extended (<span className="font-medium">renewed</span>) — or it
        (<span className="font-medium">lapses</span>). This is read-only reporting; use a
        member&apos;s detail page to invoice or send reminders.
      </p>

      {/* ── KPI cards ── */}
      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Lapsed" value={counts.lapsed} />
          <StatCard label="Upcoming" value={counts.upcoming} />
          <StatCard label="Invoiced" value={counts.invoiced} />
          <StatCard label="Paid — processing" value={counts.paid_processing} />
          <StatCard label="Renewed" value={counts.renewed} />
          <StatCard label="Outstanding renewal revenue" value={formatCents(outstandingCents)} />
          <StatCard label="Collected renewal revenue" value={formatCents(collectedCents)} />
        </div>
      </section>

      {/* ── Stage filter ── */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by stage">
          {tabs.map((t) => {
            const active = t.key === filter;
            const href = t.key === "all" ? "/admin/renewals" : `/admin/renewals?stage=${t.key}`;
            return (
              <Link
                key={t.key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors " +
                  (active
                    ? "border-accent bg-accent/10 font-semibold text-brand"
                    : "border-line text-ink/75 hover:bg-bg hover:text-brand")
                }
              >
                <span>{t.label}</span>
                <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs tabular-nums text-muted">
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Pipeline table ── */}
      <section className="mb-8">
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Credential</th>
                <th className="px-5 py-3">Expiration</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">Renewal invoice</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    {filter === "all"
                      ? "No credentials in the actionable renewal pipeline."
                      : `No credentials in the “${STAGE_META[filter].label}” stage.`}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={`${r.memberId}-${r.certNumber ?? r.certType ?? i}`}
                    className="border-b border-line last:border-0 align-top"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/members/${r.memberId}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {r.memberName}
                      </Link>
                      {r.email ? (
                        <div className="text-xs text-muted">{r.email}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <div>{r.certType ?? "—"}</div>
                      {r.certNumber ? (
                        <div className="text-xs text-muted tabular-nums">{r.certNumber}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <div className="tabular-nums">{formatDateTimeWithYear(r.expirationDate)}</div>
                      <div className={`text-xs ${urgencyColorClass(r.daysToExpiry)}`}>
                        {relativeDays(r.daysToExpiry)}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <StageBadge stage={r.stage} />
                    </td>
                    <td className="px-5 py-3">
                      {r.invoiceNumber ? (
                        <>
                          <div className="tabular-nums">{r.invoiceNumber}</div>
                          {r.invoiceStatus ? (
                            <div className="text-xs text-muted capitalize">{r.invoiceStatus}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/members/${r.memberId}#invoices`}
                        className="text-sm text-brand hover:underline"
                      >
                        Manage
                      </Link>
                      {r.email ? (
                        <>
                          <span className="px-1.5 text-muted">·</span>
                          <a
                            href={`mailto:${r.email}`}
                            className="text-sm text-brand hover:underline"
                          >
                            Email
                          </a>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
