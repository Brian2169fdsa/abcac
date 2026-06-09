import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { CtaButton } from "@/components/cta-button";
import { getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Testing",
  description: "IC&RC exam registration for ABCAC certification and AZBBHE licensure — in-person at a certified Arizona center or remote-proctored via Prometric. Your registration is not complete until payment.",
};

const licenseMap = [
  { license: "LACT (formerly LSAT)", name: "Licensed Addiction Counselor Technician", cert: "Alcohol & Drug Counselor (ADC)" },
  { license: "LAAC (formerly LASAC)", name: "Licensed Associate Addiction Counselor", cert: "Advanced Alcohol & Drug Counselor (AADC)" },
  { license: "LIAC (formerly LISAC)", name: "Licensed Independent Addiction Counselor", cert: "Advanced Alcohol & Drug Counselor (AADC)" },
];

const remoteRequirements = [
  "Government-issued photo ID (must match your registration)",
  "Quiet, well-lit, private room",
  "Stable internet, webcam, and microphone",
  "No materials unless explicitly permitted",
];

export default function TestingPage() {
  const testingProducts = getProducts().filter((p) => p.category === "Testing");
  return (
    <>
      <PageHero
        eyebrow="Exam Registration"
        title="Testing for Certification & Licensure"
        intro="Take your approved examination through ABCAC — whether you're pursuing certification with ABCAC and IC&RC or licensure through the Arizona Board of Behavioral Health Examiners (AZBBHE). Your registration is not complete until payment."
      />

      <Section title="Exam options">
        <div className="grid gap-5 md:grid-cols-2">
          {testingProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted">Not sure which to choose? See the differences between remote-proctored and in-person testing.</p>
        <CtaButton href="/remote-or-inperson" variant="outline" className="mt-3 w-full sm:w-auto">Remote vs In-Person</CtaButton>
      </Section>

      <Section surface title="AZBBHE + ABCAC certification">
        <p className="max-w-3xl text-muted">
          If you've been approved by the Arizona Board of Behavioral Health Examiners (AZBBHE), you are eligible to test
          through ABCAC — and you are exempt from the 2,000 supervised hours typically required for IC&RC certification.
        </p>
        <p className="mt-6 max-w-3xl text-muted">
          Arizona licensing titles for addiction counselors have changed. Match your license level to the correct IC&RC
          exam and ABCAC certification:
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-bg">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Arizona License</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">ABCAC Certification</th>
              </tr>
            </thead>
            <tbody>
              {licenseMap.map((r) => (
                <tr key={r.license} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{r.license}</td>
                  <td className="px-4 py-3 text-muted">{r.name}</td>
                  <td className="px-4 py-3 text-muted">{r.cert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Remote proctored IC&RC exams">
        <p className="max-w-3xl text-muted">
          ABCAC partners with <strong className="text-ink">Prometric</strong>, a global leader in online assessment, to
          offer remote-proctored IC&RC exams from your home or office. A remote proctoring fee of{" "}
          <strong className="text-ink">$50</strong> applies in addition to the exam cost.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h3 className="text-base">Requirements</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {remoteRequirements.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <h3 className="text-base">Support (Prometric)</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li>Accommodations: 1-800-789-9947 (Option 3)</li>
              <li>Schedule / reschedule (U.S./Canada): 1-800-813-6779</li>
              <li>International: +1-443-455-6299</li>
              <li>pro-proctor@prometric.com</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section surface title="About the IC&RC exam">
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-muted">
          <li>Computer-Based Testing (CBT) at IQT centers.</li>
          <li>150 multiple-choice questions (125 scored + 25 pretest).</li>
          <li>3-hour time limit.</li>
          <li>Retake after a minimum of 90 days (may be longer per member board).</li>
        </ul>
        <p className="mt-4 text-sm text-muted">An ID and room scan are required during check-in for virtual exams.</p>
      </Section>
    </>
  );
}
