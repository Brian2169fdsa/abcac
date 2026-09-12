import { requireUserId } from "@/lib/auth/current-user";
import type { ReactNode } from "react";
import Link from "next/link";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CertificateActions } from "@/components/certificate-actions";
import { AddOtherCertForm } from "@/components/portal-forms";
import { ViewFileButton } from "@/components/view-file-button";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

export const metadata = { title: "Certifications" };
export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

/** Label/value pair used by the stacked mobile card layout. */
function CertStatusPill({ status }: { status: string | null }) {
  if (status === "active")
    return <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>;
  if (status === "revoked")
    return <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">Revoked</span>;
  return <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-muted">Expired</span>;
}

/** The uploaded certificate rendered beside its credential: image inline, PDF embedded, or a clear "none yet" frame. */
function CertificatePreview({ url, kind, label }: { url: string | null; kind: "image" | "pdf" | "file" | "none"; label: string }) {
  const frame = "relative overflow-hidden rounded-lg border border-line bg-bg";
  if (!url || kind === "none") {
    return (
      <div className={`${frame} flex aspect-[11/8.5] w-full max-w-full items-center justify-center p-4 text-center`}>
        <div>
          <p className="text-sm font-semibold text-ink">No scanned certificate on file yet</p>
          <p className="mt-1 text-xs text-muted">ABCAC will attach it here when issued. Your generated PDF certificate is available under Downloads.</p>
        </div>
      </div>
    );
  }
  return (
    <figure className="w-full max-w-full">
      <a href={url} target="_blank" rel="noreferrer" className={`${frame} block aspect-[11/8.5] w-full`} aria-label={`Open ${label} full size`}>
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL; not an optimizable static asset
          <img src={url} alt={label} className="h-full w-full object-contain" />
        ) : kind === "pdf" ? (
          <object data={`${url}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" className="h-full w-full pointer-events-none" aria-label={label}>
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">PDF certificate — open to view</div>
          </object>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">Certificate file — open to view</div>
        )}
      </a>
      <figcaption className="mt-1.5 flex items-center justify-between text-xs text-muted">
        <span>Certificate on file with ABCAC</span>
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-brand">Open full size</a>
      </figcaption>
    </figure>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-muted">{children}</dd>
    </div>
  );
}

export default async function CertificationsPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();

  const [{ data: profile }, { data: certs }, { data: otherCerts }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name").eq("id", __authUserId).maybeSingle(),
    supabase.from("certifications").select("*").eq("member_id", __authUserId).order("issued_date", { ascending: false }),
    supabase.from("other_certifications").select("*").eq("member_id", __authUserId).order("issued_date", { ascending: false }),
  ]);
  const memberName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
  const rows = certs ?? [];
  const external = otherCerts ?? [];

  // Short-lived signed URLs for the scanned certificate ABCAC uploaded for each
  // credential (stored under the member's own folder, so the member's RLS-scoped
  // client may sign it). Rendered inline next to the credential text.
  const previews: Record<string, { url: string; kind: "image" | "pdf" | "file" }> = {};
  await Promise.all(
    rows
      .filter((c) => typeof c.certificate_url === "string" && c.certificate_url)
      .map(async (c) => {
        const path = c.certificate_url as string;
        const { data } = await supabase.storage.from("member-documents").createSignedUrl(path, 3600);
        if (!data?.signedUrl) return;
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const kind = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? "image" : ext === "pdf" ? "pdf" : "file";
        previews[c.id] = { url: data.signedUrl, kind };
      }),
  );
  const hasActive = rows.some((c) => c.status === "active");

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Certificate & Wallet Card"
        intro="Download your official ABCAC certificate and wallet card, and store certifications you hold from other organizations — all in one place."
      />
      <Section compact>
        {hasActive && (
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <span className="shrink-0 rounded bg-success px-3 py-1 text-xs font-semibold text-white">Active</span>
            <p className="text-sm text-green-900">
              Your certifications are in good standing. Download your certificate and wallet card below.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-line bg-surface">
          <div className="px-4 pt-4 sm:px-5">
            <h2 className="text-base font-semibold text-ink">ABCAC-Issued Certificates</h2>
            <p className="mt-1 text-sm text-muted">Your credential details sit beside the certificate ABCAC has on file for it.</p>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 pb-5 pt-2 text-sm text-muted sm:px-5">
              No certifications issued yet. Once ABCAC approves your application, your credential will appear here with
              a downloadable PDF certificate and wallet card.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="grid gap-5 px-4 py-5 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                  {/* Text: what the credential is */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{c.cert_type ?? "Credential"}</h3>
                      <CertStatusPill status={c.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 md:grid-cols-2">
                      <Field label="Number">{c.cert_number ?? "—"}</Field>
                      <Field label="IC&amp;RC Level">{c.ic_rc_level ?? "—"}</Field>
                      <Field label="Date Issued">{fmt(c.issued_date)}</Field>
                      <Field label="Expiration">{fmt(c.expiration_date)}</Field>
                    </dl>
                    <div className="mt-4 border-t border-line pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Downloads</div>
                      <div className="mt-2">
                        {c.status === "active" ? <CertificateActions cert={c} memberName={memberName} /> : <span className="text-sm text-muted">Downloads are available for active credentials.</span>}
                      </div>
                    </div>
                  </div>
                  {/* The certificate itself, right beside the text */}
                  <CertificatePreview url={previews[c.id]?.url ?? null} kind={previews[c.id]?.kind ?? "none"} label={`${c.cert_type ?? "Credential"} certificate`} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div id="other-certifications" className="mt-6 scroll-mt-32 overflow-x-auto rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="text-base font-semibold text-ink">Certifications From Other Organizations</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Hold a credential from another board or state? Record it here and upload the certificate (PDF, JPG, or
                PNG). It is stored alongside your ABCAC credentials so everything lives in one wallet.
              </p>
            </div>
            <AddOtherCertForm />
          </div>
          {external.length === 0 ? (
            <p className="px-4 pb-5 pt-3 text-sm text-muted">No outside certifications stored yet.</p>
          ) : (
            <>
            <table className="mt-3 hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Credential</th>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Issuing Board</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {external.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{c.credential_title ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.credential_number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{c.issuing_board ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.issued_date)}</td>
                    <td className="px-4 py-3 text-muted">{fmt(c.expiration_date)}</td>
                    <td className="px-4 py-3">
                      {c.doc_path
                        ? <ViewFileButton bucket="member-documents" path={c.doc_path} label="View Certificate" />
                        : <span className="text-muted">No file uploaded</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-3 px-4 pb-4 pt-3 md:hidden">
              {external.map((c) => (
                <li key={c.id} className="rounded-xl border border-line bg-bg p-4">
                  <div className="text-sm font-semibold text-ink">{c.credential_title ?? "—"}</div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Number">{c.credential_number ?? "—"}</Field>
                    <Field label="Issuing Board">{c.issuing_board ?? "—"}</Field>
                    <Field label="Issued">{fmt(c.issued_date)}</Field>
                    <Field label="Expires">{fmt(c.expiration_date)}</Field>
                  </dl>
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted">Certificate</div>
                    <div className="mt-2">
                      {c.doc_path
                        ? <ViewFileButton bucket="member-documents" path={c.doc_path} label="View Certificate" />
                        : <span className="text-sm text-muted">No file uploaded</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">IC&amp;RC International Certificate</h2>
          <p className="mt-2 text-sm text-muted">
            If you hold a reciprocal-level ABCAC credential, you may request an IC&amp;RC International Certificate — a
            globally recognized endorsement of your certification. ABCAC processes these requests directly: email us to
            confirm eligibility and receive the current request form and payment instructions.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`${siteConfig.contact.emailHref}?subject=${encodeURIComponent("IC&RC International Certificate request")}`}
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Email ABCAC to Request
            </a>
            <Link href="/account/requests" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Start a Reciprocity Transfer
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
