import type { Metadata } from "next";
import Image from "next/image";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { Check, CheckCircle2 } from "lucide-react";

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
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-6 py-16 md:grid-cols-[1fr_1.35fr] md:px-10 md:py-24 lg:px-16">
          {/* Left: copy */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-strong">
              Certification Center
            </p>
            <h1>Choose Your Certification Path</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Your gateway to professional credentials, simplified. Whether you&apos;re applying for the first time
              or renewing your certification, ABCAC is here to support your success. Choose the path that best fits
              where you are today.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="/initial-certification" size="lg" className="w-full sm:w-auto">Start My Certification</CtaButton>
              <CtaButton href="/certification-renewal" variant="outline" size="lg" className="w-full sm:w-auto">Renew My Certification</CtaButton>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink">
              {["IC&RC Recognized", "Arizona Based", "1,200+ Certified"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: hero image with maroon arc accent */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full border-[6px] border-brand/70 md:-right-6 md:h-36 md:w-36"
            />
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-bg shadow-lg ring-1 ring-black/5">
              <Image
                src="/brand/choose-path-hero.png"
                alt="Choose your ABCAC certification path"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
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
              <CtaButton href={p.cta.href} className="mt-6 w-full sm:w-auto sm:self-start">{p.cta.label}</CtaButton>
            </div>
          ))}
        </div>
      </Section>
      <Section surface compact title="Become an ABCAC Board Member">
        <p className="max-w-3xl text-muted">
          If you possess expertise in behavioral or mental health, we extend a warm invitation for you to join our board
          of directors. Your insights are invaluable. Please contact us to request the application form.
        </p>
        <CtaButton href="/contact" variant="outline" className="mt-6 w-full sm:w-auto">Contact ABCAC</CtaButton>
      </Section>
    </>
  );
}
