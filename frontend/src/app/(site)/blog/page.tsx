import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and updates from the Arizona Board for Certification of Addiction Counselors.",
};

export default function BlogPage() {
  return (
    <>
      <PageHero eyebrow="News & Updates" title="ABCAC Blog" intro="Articles and updates are coming soon." />
      <Section>
        <p className="max-w-2xl text-muted">
          Our blog is being prepared. In the meantime, explore certification paths or reach out with questions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CtaButton href="/choose-your-cert-path">Choose Your Cert Path</CtaButton>
          <CtaButton href="/contact" variant="outline">Contact ABCAC</CtaButton>
        </div>
      </Section>
    </>
  );
}
