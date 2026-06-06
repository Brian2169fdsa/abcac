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

      <Section title="Renew and maintain your credential">
        <p className="max-w-3xl text-muted">
          Renewal ensures your certification remains active and recognized, supporting your continued growth and
          accountability in addiction counseling, peer support, prevention, and supervision. Whether you need to submit
          continuing education, update your contact information, or confirm your supervised hours, ABCAC provides clear
          instructions, downloadable packets, and responsive support.
        </p>
        <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-5 text-muted">
          <li>All ABCAC credentials renew every <strong className="text-ink">2 years</strong>.</li>
          <li>Recertification requires completion of <strong className="text-ink">Ethics</strong> and <strong className="text-ink">Cultural Diversity</strong> education, plus continuing education in the field of your certification.</li>
          <li>Include copies of your CE certificates with your recertification package.</li>
          <li>Payment of the <strong className="text-ink">$150</strong> 2-year renewal fee.</li>
        </ul>
        <div className="mt-5 rounded-xl border border-line bg-bg p-4 text-sm text-muted">
          <strong className="text-ink">Note:</strong> HIV/AIDS education is only required for your initial
          certification — it is not needed for recertification.
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          {renewal && (
            <CtaButton href={`/store/${renewal.slug}`} size="lg">
              Pay Renewal Fee — <PriceTag product={renewal} className="ml-1 text-white" />
            </CtaButton>
          )}
          <CtaButton href="/ceu" variant="outline">Continuing Education Info</CtaButton>
        </div>
      </Section>

      <Section surface compact title="Recertification packages">
        <p className="max-w-3xl text-muted">
          Select the recertification form for your current credential, complete it, then submit your documents and
          payment through the ABCAC portal. Packages are available for:
        </p>
        <ul className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
          {["CAC / CADAC / AADC Recertification", "Certified Prevention Specialist (CPS) Recertification", "Certified Clinical Supervisor (CCS) Recertification", "Certified Peer Recovery Specialist (CPRS) Recertification"].map((p) => (
            <li key={p} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted">{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="Holding multiple credentials?">
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
