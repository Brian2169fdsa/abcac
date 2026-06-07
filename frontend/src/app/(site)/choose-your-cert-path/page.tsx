import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Choose Your Cert Path",
  description: "Whether you're applying for the first time or renewing, ABCAC guides you to the right path — requirements, forms, uploads, and payments all in one place.",
};

const paths = [
  {
    title: "Initial Certification",
    blurb: "Start your journey as a certified addiction counselor. We'll guide you through the full process:",
    points: ["Requirements", "Application forms", "Exam scheduling", "Payment options"],
    note: "Whether you're applying for CAC, CADAC, AADC, or another credential — it's all right here.",
    cta: { label: "Start My Certification", href: "/initial-certification" },
  },
  {
    title: "Recertification",
    blurb: "Stay active and in good standing. This path walks you through:",
    points: ["CEU requirements (including Ethics & Cultural Diversity)", "Recertification packets", "Uploads & payments", "Easy online submission"],
    note: "Simple, fast, and fully digital.",
    cta: { label: "Renew My Certification", href: "/certification-renewal" },
  },
];

export default function ChooseCertPathPage() {
  return (
    <>
      <PageHero
        eyebrow="Certification Center"
        title="Choose Your Certification Path"
        intro="Your gateway to professional credentials, simplified. Whether you're applying for the first time or renewing your certification, ABCAC is here to support your success. Choose the path that best fits where you are today."
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {paths.map((p) => (
            <div key={p.title} className="flex flex-col rounded-xl border border-line bg-surface p-7">
              <h2 className="text-xl">{p.title}</h2>
              <p className="mt-2 text-muted">{p.blurb}</p>
              <ul className="mt-4 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-muted">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success" aria-hidden /> {pt}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex-1 text-sm text-muted">{p.note}</p>
              <CtaButton href={p.cta.href} className="mt-6 self-start">{p.cta.label}</CtaButton>
            </div>
          ))}
        </div>
      </Section>
      <Section surface compact title="Become an ABCAC Board Member">
        <p className="max-w-3xl text-muted">
          If you possess expertise in behavioral or mental health, we extend a warm invitation for you to join our board
          of directors. Your insights are invaluable. Please contact us to request the application form.
        </p>
        <CtaButton href="/contact" variant="outline" className="mt-6">Contact ABCAC</CtaButton>
      </Section>
    </>
  );
}
