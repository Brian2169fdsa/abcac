import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { FAQS, EXTRA_FAQS } from "@/lib/faqs";

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
        <div className="mx-auto max-w-3xl divide-y divide-line">
          {all.map((f) => (
            <div key={f.q} className="py-6">
              <h3 className="text-lg">{f.q}</h3>
              <p className="mt-2 text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
