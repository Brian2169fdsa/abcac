import type { Metadata } from "next";
import { FAQS, EXTRA_FAQS } from "@/lib/faqs";
import { FaqSection } from "@/components/faq-section";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ABCAC certification, licensure, IC&RC reciprocity, exams, renewals, and getting started.",
};

export default function FaqPage() {
  const all = [...FAQS, ...EXTRA_FAQS];
  return (
    <FaqSection
      eyebrow="ABCAC Help Center"
      intro="Clear guidance for certification, renewal, testing, reciprocity, continuing education, and account access."
      items={all}
    />
  );
}
