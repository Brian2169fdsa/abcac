import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Clock, Mail, CheckCircle2, Search, HelpCircle, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { VerifyForm } from "@/components/verify-form";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  lookupByCertNumber,
  searchDirectory,
  isCurrentlyValid,
  type PublicCredential,
} from "@/lib/directory";
import {
  parseVerifyParams,
  decideMode,
  certResultKind,
  clampLimit,
  formatCredDate,
  type VerifySearchParams,
} from "@/lib/verify-lookup";

export const metadata: Metadata = {
  title: "Verify a Certification",
  description:
    "Instantly verify an ABCAC credential by certification number, or request an official written verification from the Arizona Board for Certification of Addiction Counselors.",
};

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: VerifySearchParams;
}) {
  const c = siteConfig.contact;
  const query = parseVerifyParams(searchParams);
  const mode = decideMode(query);

  // Run the relevant anon-readable lookup (the directory view is granted to anon).
  let cred: PublicCredential | null = null;
  let nameRows: PublicCredential[] = [];
  let nameTotal = 0;

  if (mode === "cert") {
    const sb = createSupabaseServerClient();
    cred = await lookupByCertNumber(sb, query.cert);
  } else if (mode === "name") {
    const sb = createSupabaseServerClient();
    const { rows, total } = await searchDirectory(sb, {
      name: query.name,
      limit: clampLimit(10),
    });
    nameRows = rows;
    nameTotal = total;
  }

  return (
    <>
      <PageHero
        eyebrow="Certification verification"
        title="Verify a Certification"
        intro="Instantly confirm an ABCAC credential by certification number, or request an official written verification. Public listings show only name, credential, and status."
      />

      <Section eyebrow="Instant lookup" title="Verify a credential now">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* Search form */}
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-7">
            <form method="get" className="space-y-4">
              <div>
                <label htmlFor="cert" className="mb-1.5 block text-sm font-semibold">
                  Certification number
                </label>
                <input
                  id="cert"
                  name="cert"
                  defaultValue={query.cert}
                  placeholder="e.g. AZ-CADAC-50403"
                  className={field}
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
                  Or search by name <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={query.name}
                  placeholder="Counselor name"
                  className={field}
                  autoComplete="off"
                />
              </div>
              <p className="-mt-1 text-xs text-muted">
                Enter a certification number for an exact verification, or a name to search the public
                directory.
              </p>
              <Button type="submit" size="lg" className="w-full sm:w-auto">
                <Search className="h-5 w-5" aria-hidden /> Look up
              </Button>
            </form>
          </div>

          {/* Result area */}
          <div>
            {mode === "idle" && (
              <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-line bg-surface p-7 text-muted">
                <p className="font-semibold text-ink">Confirm a credential in seconds.</p>
                <p className="mt-2 text-sm">
                  Results show whether the credential is active and in good standing. For an official
                  written verification letter, use the request form below.
                </p>
              </div>
            )}

            {mode === "cert" && <CertResult cred={cred} certInput={query.cert} />}

            {mode === "name" && (
              <NameResults rows={nameRows} total={nameTotal} nameInput={query.name} />
            )}
          </div>
        </div>
      </Section>

      <span id="official" className="block" />
      <Section surface compact eyebrow="Official verification" title="Need an official written verification?">
        <p className="-mt-4 mb-8 max-w-2xl text-muted">
          Employers, agencies, and credentialing boards can request a formal, written confirmation of a
          counselor&rsquo;s standing. Submit the request below and our team will respond by email.
        </p>
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-line bg-bg p-5 sm:p-7">
            <VerifyForm />
          </div>
          <div className="space-y-6">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <p className="text-muted">
                We confirm whether the named counselor holds a valid {siteConfig.shortName} certification.
              </p>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <p className="text-muted">
                Most requests are reviewed within a few business days. You will receive the outcome by email.
              </p>
            </div>
            <div className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <a href={c.emailHref} className="text-muted hover:text-brand">
                {c.email}
              </a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/** Exact cert-number verification result card. */
function CertResult({ cred, certInput }: { cred: PublicCredential | null; certInput: string }) {
  const valid = cred ? isCurrentlyValid(cred) : false;
  const kind = certResultKind(cred, valid);

  if (kind === "not-found") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-muted" aria-hidden />
          <div>
            <p className="text-lg font-semibold">No active credential found for that number</p>
            <p className="mt-2 text-sm text-muted">
              We couldn&rsquo;t match{" "}
              <span className="font-medium text-ink">{certInput}</span> to an active, publicly listed
              credential. Please double-check the certification number. Some counselors choose not to
              appear in the public directory, so a missing result does not necessarily mean a person is
              not certified.
            </p>
            <p className="mt-3 text-sm text-muted">
              For a definitive answer, request an{" "}
              <a href="#official" className="font-medium text-brand hover:underline">
                official written verification
              </a>{" "}
              below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // verified-active or verified-lapsed
  const active = kind === "verified-active";
  return (
    <div
      className={`rounded-xl border bg-surface p-6 sm:p-7 ${
        active ? "border-success/40" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3">
        {active ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-success" aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{cred?.full_name}</p>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                active ? "bg-success text-white" : "bg-line text-ink"
              }`}
            >
              {active ? "Verified — Active" : "Not currently valid"}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Credential</dt>
              <dd className="font-medium">{cred?.cert_type}</dd>
            </div>
            <div>
              <dt className="text-muted">Certification number</dt>
              <dd className="font-medium">{cred?.cert_number}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="font-medium capitalize">{cred?.status}</dd>
            </div>
            <div>
              <dt className="text-muted">Issued</dt>
              <dd className="font-medium">{formatCredDate(cred?.issued_date ?? null)}</dd>
            </div>
            <div>
              <dt className="text-muted">Expires</dt>
              <dd className="font-medium">{formatCredDate(cred?.expiration_date ?? null)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-muted">
            {active
              ? "This credential is valid and in good standing."
              : "This credential is on record but is not currently valid. For details, request an official written verification below."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Compact name-search results list. */
function NameResults({
  rows,
  total,
  nameInput,
}: {
  rows: PublicCredential[];
  total: number;
  nameInput: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-muted" aria-hidden />
          <div>
            <p className="text-lg font-semibold">No public listings found</p>
            <p className="mt-2 text-sm text-muted">
              No publicly listed credentials matched{" "}
              <span className="font-medium text-ink">{nameInput}</span>. Try a different spelling, search
              by certification number instead, or note that some counselors opt out of the public
              directory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <p className="mb-3 text-sm text-muted">
        Showing {rows.length} of {total} match{total === 1 ? "" : "es"} for{" "}
        <span className="font-medium text-ink">{nameInput}</span>. Select a result to confirm its
        details.
      </p>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.cert_number}>
            <Link
              href={`/verify?cert=${encodeURIComponent(r.cert_number)}`}
              className="flex items-center justify-between gap-3 py-3 hover:text-brand"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.full_name}</span>
                <span className="block text-xs text-muted">
                  {r.cert_type} · {r.cert_number} ·{" "}
                  <span className="capitalize">{r.status}</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        Browse everyone in the{" "}
        <Link href="/directory" className="font-medium text-brand hover:underline">
          full public directory
        </Link>
        .
      </p>
    </div>
  );
}
