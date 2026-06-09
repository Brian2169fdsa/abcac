import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";

export const metadata: Metadata = {
  title: "About IC&RC",
  description: "ABCAC is an official IC&RC member board. IC&RC credentials are recognized across member boards in 16 countries, ensuring mobility, consistency, and trust.",
};

const examFacts = [
  "Computer-Based Testing (CBT) at IQT centers.",
  "150 multiple-choice questions (125 scored + 25 pretest).",
  "3-hour time limit.",
  "Retake after a minimum of 90 days (may be longer per member board).",
];

const intlCerts = [
  "ICADC — Internationally Certified Alcohol and Drug Counselor",
  "ICAADC — Internationally Certified Advanced Alcohol and Drug Counselor",
  "ICCS — Internationally Certified Clinical Supervisor",
  "ICPS — Internationally Certified Prevention Specialist",
  "ICCJP — Internationally Certified Criminal Justice Professional",
  "ICPR — Internationally Certified Peer Recovery",
  "ICPR-A — Internationally Certified Peer Recovery – Associate",
];

export default function IcRcPage() {
  return (
    <>
      <PageHero
        eyebrow="Global Standards"
        title="About the International Certification & Reciprocity Consortium (IC&RC)"
        intro="ABCAC is proud to serve as an official IC&RC member board. IC&RC is the global leader in credentialing for prevention, addiction treatment, and recovery professionals — representing over 78 certification boards and 50,000 professionals worldwide."
      />

      <Section title="Mission & Vision">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h3>Mission</h3>
            <p className="mt-2 text-muted">IC&RC is committed to promoting public protection by providing internationally recognized credentials and examinations for prevention, substance use treatment, and recovery professionals.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <h3>Vision</h3>
            <p className="mt-2 text-muted">IC&RC aims to be the globally recognized leader in prevention, substance use treatment, and recovery credentialing.</p>
          </div>
        </div>
      </Section>

      <Section surface title="The IC&RC exam">
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-muted">
          {examFacts.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          IC&RC provides official candidate guides, recommended study materials, and online practice exams. ABCAC does
          not sell or distribute these materials — all resources are hosted by IC&RC and subject to their terms.
        </p>
        <CtaButton href="/testing" className="mt-6 w-full sm:w-auto">Register for Testing</CtaButton>
      </Section>

      <Section title="Request an IC&RC International Certificate">
        <p className="max-w-3xl text-muted">
          If you're currently certified by ABCAC at the reciprocal level, you may be eligible for an internationally
          recognized credential through IC&RC. The International Certificate mirrors your ABCAC-issued certification and
          carries the same expiration date. A $30 fee applies per certificate requested.
        </p>
        <ul className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-2">
          {intlCerts.map((c) => (
            <li key={c} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-muted">{c}</li>
          ))}
        </ul>
        <CtaButton href="/contact" variant="outline" className="mt-6 w-full sm:w-auto">Confirm Eligibility with ABCAC</CtaButton>
      </Section>
    </>
  );
}
