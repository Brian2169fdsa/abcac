import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { CtaButton } from "@/components/cta-button";
import { getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Testing",
  description: "IC&RC exam registration for ABCAC certification and AZBBHE licensure — in-person at a certified Arizona center or remote-proctored. Your registration is not complete until payment.",
};

export default function TestingPage() {
  const testingProducts = getProducts().filter((p) => p.category === "Testing");
  return (
    <>
      <PageHero
        eyebrow="Exam Registration"
        title="Testing for Certification & Licensure"
        intro="ABCAC provides IC&RC certification exams and supports licensure testing through AZBBHE. Choose in-person testing at a certified Arizona center or a remote-proctored exam. Your registration is not complete until payment."
      />

      <Section title="Exam options">
        <div className="grid gap-5 md:grid-cols-2">
          {testingProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          Not sure which to choose? See the differences between remote-proctored and in-person testing.
        </p>
        <CtaButton href="/remote-or-inperson" variant="outline" className="mt-3">Remote vs In-Person</CtaButton>
      </Section>

      <Section surface title="About the IC&RC exam">
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-muted">
          <li>Computer-Based Testing (CBT) at IQT centers.</li>
          <li>150 multiple-choice questions (125 scored + 25 pretest).</li>
          <li>3-hour time limit.</li>
          <li>Retake after a minimum of 90 days (may be longer per member board).</li>
        </ul>
      </Section>
    </>
  );
}
