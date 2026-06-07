import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
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
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-6 py-16 md:grid-cols-[1fr_1.35fr] md:px-10 md:py-24 lg:px-16">
          {/* Left: copy */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-strong">
              Recertification
            </p>
            <h1>Certification Renewal</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              All ABCAC credentials renew every two years. This path walks you through your CEU documentation,
              recertification packet, uploads, and payment — simple, fast, and fully digital.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {renewal && (
                <CtaButton href={`/store/${renewal.slug}`} size="lg">
                  Pay Renewal Fee — <PriceTag product={renewal} className="ml-1 text-white" />
                </CtaButton>
              )}
              <CtaButton href="/ceu" variant="outline" size="lg">CEU Requirements</CtaButton>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink">
              {["IC&RC Recognized", "Arizona Based", "1,200+ Certified"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: hero image with maroon arc accent */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full border-[6px] border-brand/70 md:-right-6 md:h-36 md:w-36"
            />
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-bg shadow-lg ring-1 ring-black/5">
              <Image
                src="/brand/renewal-hero.png"
                alt="ABCAC certification renewal"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

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
        <div className="mt-8 rounded-xl border border-line bg-bg p-5">
          <p className="text-muted">Paid your renewal fee? Submit your recertification and CE certificates online.</p>
          <CtaButton href="/account/renew" variant="outline" className="mt-3">Submit Recertification</CtaButton>
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
