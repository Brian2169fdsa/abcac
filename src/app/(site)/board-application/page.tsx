import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { BoardApplicationForm } from "@/components/board-application-form";
import { CtaButton } from "@/components/cta-button";

export const metadata: Metadata = {
  title: "Board Member Application",
  description:
    "Apply to join the Arizona Board for the Certification of Addiction Counselors (ABCAC) Board of Directors. Complete the application online and attach your resume or CV.",
};

export default function BoardApplicationPage() {
  return (
    <>
      <PageHero
        eyebrow="Get involved"
        title="ABCAC Board Member Application"
        intro="Thank you for your interest in joining the Arizona Board for the Certification of Addiction Counselors (ABCAC) Board of Directors. Please complete the application below and submit it with your resume or CV."
      />
      <Section>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 rounded-2xl border border-brand/20 bg-brand/[0.05] p-6"><h2 className="text-2xl">Save and return to the official board packet</h2><p className="mt-2 text-muted">Sign in to complete the unchanged ABCAC board application digitally, save a draft, or download the original paper form.</p><div className="mt-5 flex flex-wrap gap-3"><CtaButton href="/account/forms?workflow=board%3Amember">Complete Official Packet Digitally</CtaButton><CtaButton href="/forms/library/board-member.pdf" variant="outline">Download Paper Form</CtaButton></div></div>
          <BoardApplicationForm />
        </div>
      </Section>
    </>
  );
}
