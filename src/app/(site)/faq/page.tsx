import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { FAQS, EXTRA_FAQS } from "@/lib/faqs";
import { FaqAccordion } from "@/components/faq-accordion";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ABCAC certification, licensure, IC&RC reciprocity, exams, renewals, and getting started.",
};

export default function FaqPage() {
  const all = [...FAQS, ...EXTRA_FAQS];
  return (
    <>
      <PageHero eyebrow="Help" title="Frequently Asked Questions" />
      <Section>
        <FaqAccordion items={all} />
      </Section>
    </>
  );
}
