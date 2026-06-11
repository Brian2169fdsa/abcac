import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  searchDirectory,
  isCurrentlyValid,
  CREDENTIAL_TYPES,
  type PublicCredential,
} from "@/lib/directory";
import {
  parseParams,
  pageOffset,
  totalPages,
  formatShowing,
  buildQuery,
  PAGE_SIZE,
  type DirectoryParams,
} from "./params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Counselor Directory",
  description:
    "Browse Arizona Board for Certification of Addiction Counselors (ABCAC) certified counselors in good standing.",
};

type SearchParams = Record<string, string | string[] | undefined>;

/** "Jan 5, 2026" or an em dash when missing. */
function formatDate(d: string | null): string {
  if (!d) return "—";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CredentialCard({ cred }: { cred: PublicCredential }) {
  const valid = isCurrentlyValid(cred);
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">{cred.full_name}</h3>
        {valid ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/5 px-2.5 py-0.5 text-xs font-semibold text-success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-line bg-bg px-2.5 py-0.5 text-xs font-semibold text-muted">
            Inactive
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-1 text-sm text-muted">
        <div className="flex justify-between gap-3">
          <dt>Credential</dt>
          <dd className="font-medium text-ink">{cred.cert_type}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Certificate #</dt>
          <dd className="font-mono text-ink">{cred.cert_number}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Expires</dt>
          <dd className="text-ink">{formatDate(cred.expiration_date)}</dd>
        </div>
      </dl>
      <Link
        href={`/verify?cert=${encodeURIComponent(cred.cert_number)}`}
        className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand hover:underline"
      >
        Verify this credential
      </Link>
    </div>
  );
}

function FilterControls({ params }: { params: DirectoryParams }) {
  return (
    <form method="get" action="/directory" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Search by name</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Counselor name"
            className="h-11 w-full rounded-lg border border-line bg-bg pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Credential</span>
        <select
          name="type"
          defaultValue={params.type}
          className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-40"
        >
          <option value="all">All credentials</option>
          {CREDENTIAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand/90"
      >
        Search
      </button>
    </form>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = parseParams(searchParams);

  const sb = createSupabaseServerClient();
  const { rows, total } = await searchDirectory(sb, {
    name: params.q,
    certType: params.type,
    limit: PAGE_SIZE,
    offset: pageOffset(params.page),
  });

  const pages = totalPages(total);
  // Clamp the displayed page so prev/next math stays in range.
  const currentPage = Math.min(params.page, pages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < pages;

  const prevHref = `/directory${buildQuery(params, { page: currentPage - 1 })}`;
  const nextHref = `/directory${buildQuery(params, { page: currentPage + 1 })}`;

  return (
    <>
      <PageHero
        eyebrow="Public registry"
        title="Certified Counselor Directory"
        intro="Browse Arizona Board for Certification of Addiction Counselors (ABCAC) counselors in good standing. The directory lists only active, certified counselors who have not opted out of public listing — no contact details are shown."
      />
      <Section>
        <FilterControls params={params} />

        <div className="mt-8">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface p-8 text-center">
              <p className="text-lg font-semibold text-ink">No counselors match your search</p>
              <p className="mx-auto mt-2 max-w-md text-muted">
                Try a different name or credential type. Some certified counselors may
                have opted out of public listing and will not appear here even though
                their credential is valid.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                {formatShowing(currentPage, rows.length, total)}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((cred) => (
                  <CredentialCard key={cred.cert_number} cred={cred} />
                ))}
              </div>

              {(hasPrev || hasNext) && (
                <nav
                  aria-label="Directory pagination"
                  className="mt-8 flex items-center justify-between gap-4"
                >
                  {hasPrev ? (
                    <Link
                      href={prevHref}
                      className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-muted">
                    Page {currentPage} of {pages}
                  </span>
                  {hasNext ? (
                    <Link
                      href={nextHref}
                      className="inline-flex min-h-[44px] items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
                    >
                      Next
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
          This directory shows only active credentials whose holders have opted in to
          public listing. For formal written confirmation of a counselor&apos;s standing,
          use our{" "}
          <Link href="/verify" className="font-semibold text-brand hover:underline">
            certification verification
          </Link>{" "}
          request.
        </p>
      </Section>
    </>
  );
}
