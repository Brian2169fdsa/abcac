import type { Metadata } from "next";
import { Monitor, MapPin } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Remote or In-Person",
  description: "Choose between a remote-proctored IC&RC exam via Prometric's ProProctor platform or in-person testing at an authorized site. Your registration is not complete until payment.",
};

export default function RemoteOrInPersonPage() {
  const remote = getProductBySlug("testing-for-licensure-with-azbbhe-remote-proctored-exam");
  const inPerson = getProductBySlug("testing-for-licensure-with-azbbhe");

  return (
    <>
      <PageHero
        eyebrow="Exam Mode"
        title="Remote or In-Person?"
        intro="Your registration is not complete until payment. Select the option that best fits your needs and complete checkout to finish."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-line bg-surface p-7">
            <Monitor className="h-8 w-8 text-brand" aria-hidden />
            <h2 className="mt-4 text-xl">Remote Proctored Exam</h2>
            <p className="mt-2 flex-1 text-muted">
              Take your exam from home or a private space using Prometric's ProProctor platform. You'll be monitored
              live online and must meet the system and environment requirements before testing. Best for candidates who
              need flexibility or are far from a testing center.
            </p>
            {remote && (
              <CtaButton href={`/store/${remote.slug}`} className="mt-6 w-full sm:w-auto sm:self-start">
                Pay Now — <PriceTag product={remote} className="ml-1 text-white" />
              </CtaButton>
            )}
          </div>
          <div className="flex flex-col rounded-xl border border-line bg-surface p-7">
            <MapPin className="h-8 w-8 text-brand" aria-hidden />
            <h2 className="mt-4 text-xl">In-Person Exam</h2>
            <p className="mt-2 flex-1 text-muted">
              Test at an authorized site with onsite staff and secure testing conditions. You'll schedule your exam at a
              physical location after registration is processed. Best for candidates who prefer a traditional testing
              environment or have limited internet access.
            </p>
            {inPerson && (
              <CtaButton href={`/store/${inPerson.slug}`} className="mt-6 w-full sm:w-auto sm:self-start">
                Pay Now — <PriceTag product={inPerson} className="ml-1 text-white" />
              </CtaButton>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
