import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { BoardApplicationForm } from "@/components/board-application-form";

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
          <BoardApplicationForm />
        </div>
      </Section>
    </>
  );
}
