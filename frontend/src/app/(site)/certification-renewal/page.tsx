import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Certification Renewal",
  description: "All ABCAC credentials renew every two years. Complete your continuing education and pay the $150 renewal fee to stay active and in good standing.",
};

export default function CertificationRenewalPage() {
  const renewal = getProductBySlug("certification-renewal-2-year-credential-renewal-fee");
  const sync = getProductBySlug("certification-sync");

  return (
    <>
      <PageHero
        eyebrow="Recertification"
        title="Certification Renewal"
        intro="All ABCAC credentials renew every two years. This path walks you through your CEU documentation, recertification packet, uploads, and payment — simple, fast, and fully digital."
      />

      <Section title="What renewal requires">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-muted">
          <li>Renewal of your credential every <strong className="text-ink">2 years</strong>.</li>
          <li>Completion of your continuing education hours, including the required <strong className="text-ink">Ethics</strong> and <strong className="text-ink">Cultural Diversity</strong> hours.</li>
          <li>Submission of your recertification packet and CEU documentation through the ABCAC portal.</li>
          <li>Payment of the <strong className="text-ink">$150</strong> 2-year renewal fee.</li>
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {renewal && (
            <CtaButton href={`/store/${renewal.slug}`} size="lg">
              Pay Renewal Fee — <PriceTag product={renewal} className="ml-1 text-white" />
            </CtaButton>
          )}
          <CtaButton href="/ceu" variant="outline">Continuing Education Info</CtaButton>
        </div>
      </Section>

      <Section surface title="Holding multiple credentials?">
        <p className="max-w-3xl text-muted">
          Align the renewal dates of your CADAC, CCJP, AADC, or other ABCAC certifications into one unified cycle with
          Certification Sync. Eliminate staggered renewals and manage everything together.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {sync && (
            <CtaButton href={`/store/${sync.slug}`} variant="accent">
              Sync Your Certs — <PriceTag product={sync} className="ml-1" />
            </CtaButton>
          )}
        </div>
      </Section>
    </>
  );
}
