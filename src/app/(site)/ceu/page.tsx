import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "CEU Providers & Workshop Endorsement",
  description: "Continuing education provider status and workshop endorsement with ABCAC. Annual provider fee and per-workshop endorsement tiers.",
};

const tiers = [
  "ceu-workshop-endorsement-up-to-8-contact-hours",
  "ceu-workshop-endorsement-9-15-contact-hours",
  "ceu-workshop-endorsement-more-than-15-contact-hours",
];

const endorseSteps = [
  "Download and complete the workshop endorsement application.",
  "Choose the correct fee tier based on total contact hours.",
  "Submit via email to abcac@abcac.org or upload through the portal.",
  "Wait for approval — standard turnaround is 4 weeks.",
];

export default function CeuPage() {
  const annual = getProductBySlug("annual-credential-fee-approved-ceu-providers");
  const tierProducts = tiers.map((s) => getProductBySlug(s)).filter(Boolean);

  return (
    <>
      <PageHero
        eyebrow="Continuing Education"
        title="CEU Providers & Workshop Endorsement"
        intro="ABCAC ensures that all continuing education opportunities meet professional standards for addiction counselors in Arizona. This page is for organizations and educators seeking to maintain provider status or submit workshops for endorsement."
      />

      <Section title="CEU Provider Annual Credential Fee">
        <p className="max-w-3xl text-muted">
          All approved CEU providers submit an annual credential maintenance fee of <strong className="text-ink">$500</strong> to
          retain active status with ABCAC. This supports ongoing administrative oversight, compliance monitoring, and
          inclusion in ABCAC's public directory of approved CEU providers. The fee is due annually on the anniversary of
          your initial approval date.
        </p>
        <div className="mt-6">
          {annual && (
            <CtaButton href={`/store/${annual.slug}`} className="h-auto w-full whitespace-normal py-3 text-center sm:w-auto sm:py-0">
              Submit Annual CEU Fee — <PriceTag product={annual} className="ml-1 text-white" />
            </CtaButton>
          )}
        </div>
      </Section>

      <Section surface title="CEU Workshop Endorsement Fees" intro="Each workshop submitted for ABCAC CEU endorsement is subject to a one-time review fee based on total contact hours.">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
          {tierProducts.map((p) => (
            <div key={p!.slug} className="flex flex-col rounded-xl border border-line bg-bg p-5 sm:p-6">
              <h3 className="text-base">{p!.name.replace("CEU Workshop Endorsement ", "")}</h3>
              <div className="mt-3"><PriceTag product={p!} className="text-2xl" /></div>
              <CtaButton href={`/store/${p!.slug}`} variant="outline" size="sm" className="mt-5 w-full sm:w-auto sm:self-start">Submit for Endorsement</CtaButton>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h3>How to endorse a CEU workshop</h3>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
            {endorseSteps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-4 text-sm text-muted">
            Questions? Email{" "}
            <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a>{" "}
            or call <a href={siteConfig.contact.phoneHref} className="font-semibold text-brand">{siteConfig.contact.phone}</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
