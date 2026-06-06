import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ABCAC certification, renewals, and the IC&RC exam.",
};

const faqs = [
  { q: "How often do ABCAC credentials renew?", a: "All ABCAC credentials renew every two years. Renewal requires completing your continuing education hours and paying the $150 renewal fee." },
  { q: "What does the IC&RC exam look like?", a: "It's Computer-Based Testing at IQT centers: 150 multiple-choice questions (125 scored + 25 pretest) with a 3-hour limit. If needed, you may retake after a minimum of 90 days (may be longer per member board)." },
  { q: "Can I take the exam remotely?", a: "Yes. You can choose a remote-proctored exam via Prometric's ProProctor platform, or test in person at an authorized Arizona center. See the Testing page to register." },
  { q: "How do I move my credential to or from Arizona?", a: "Through IC&RC reciprocity. To transfer to Arizona, initiate with your current board (a $150 fee is due on approval). To transfer out, email ABCAC for the Reciprocity Request Form. Allow up to 4 weeks." },
  { q: "How long does CEU workshop endorsement take?", a: "Standard review turnaround is 4 weeks. Submit your workshop materials to abcac@abcac.org and pay the fee tier matching your total contact hours." },
  { q: "Will I receive a paper certificate?", a: "ABCAC issues official digital certificates upon approval or renewal. A printed copy can be requested for a $25 processing and mailing fee." },
];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="Help" title="Frequently Asked Questions" />
      <Section>
        <div className="mx-auto max-w-3xl divide-y divide-line">
          {faqs.map((f) => (
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
