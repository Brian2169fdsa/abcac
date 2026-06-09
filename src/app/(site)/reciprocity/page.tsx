import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Reciprocity",
  description: "Transfer your approved IC&RC credential to or from Arizona through ABCAC, in full alignment with IC&RC reciprocity standards.",
};

const abcacCredentials = [
  "Certified Alcohol and Drug Abuse Counselor (CADAC)",
  "Advanced Alcohol and Drug Counselor (AADC)",
  "Certified Prevention Specialist (CPS)",
  "Certified Peer Recovery Specialist (CPRS)",
  "Certified Criminal Justice Professional (CCJP)",
  "Certified Clinical Supervisor (CCS)",
];

export default function ReciprocityPage() {
  const certOnly = getProductBySlug("certification-certification-only-fee-already-passed-icrc-exam");
  return (
    <>
      <PageHero
        eyebrow="Credential Mobility"
        title="Reciprocity Transfers"
        intro="Easily transfer your approved IC&RC credential to or from Arizona through ABCAC. We ensure full alignment with IC&RC reciprocity standards and international member boards."
      />

      <Section title="Transferring to Arizona">
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-muted">
          <li>You must already hold an IC&RC-recognized credential from your current certifying board.</li>
          <li>Initiate the transfer with your current board — they will contact ABCAC to begin the reciprocity process.</li>
          <li>ABCAC reviews your credential and notifies you once your transfer is approved.</li>
          <li>If it's been more than 4 weeks without an update, contact both your original board and IC&RC.</li>
        </ul>
        <p className="mt-4 text-muted"><strong className="text-ink">Fee:</strong> $150, due upon approval.</p>
        <div className="mt-6">
          {certOnly && (
            <CtaButton href={`/store/${certOnly.slug}`} className="w-full sm:w-auto">
              Pay Certification Fee — <PriceTag product={certOnly} className="ml-1 text-white" />
            </CtaButton>
          )}
        </div>
      </Section>

      <Section surface title="Transferring from Arizona">
        <p className="max-w-3xl text-muted">
          To transfer an ABCAC-issued IC&RC credential to another IC&RC board, email{" "}
          <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a>{" "}
          to request the Reciprocity Request Form. Include your full name and a valid contact email. Please allow up to
          4 weeks for processing. ABCAC-issued IC&RC credentials include:
        </p>
        <ul className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-2">
          {abcacCredentials.map((c) => (
            <li key={c} className="rounded-lg border border-line bg-bg px-4 py-2.5 text-sm text-muted">{c}</li>
          ))}
        </ul>
        <CtaButton href="/contact" variant="outline" className="mt-6 w-full sm:w-auto">Request the Reciprocity Form</CtaButton>
      </Section>
    </>
  );
}
