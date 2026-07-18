import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { Section } from "@/components/section";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Initial Certification",
  description: "Apply for initial ABCAC certification — eligibility, credential levels, application steps, and exam registration, recognized by IC&RC.",
};

const credentials = [
  { code: "CAC", name: "Certified Addiction Counselor", desc: "For individuals beginning their career in addiction counseling. Validates foundational knowledge in substance use disorders, behavioral sciences, and practical counseling experience.", req: "High school diploma or GED, 200–250 hours of addiction and behavioral sciences education, and 2 years / 4,000 hours of work experience." },
  { code: "CADAC", name: "Certified Alcohol & Drug Abuse Counselor", desc: "For professionals with a bachelor's degree and extensive field experience. Recognizes advanced competency in assessment, treatment planning, and client care for individuals with substance use disorders.", req: "Bachelor's degree, 200 hours of addiction and counseling studies, and 3 years / 6,000 hours of work experience." },
  { code: "AADC", name: "Advanced Alcohol & Drug Counselor", desc: "The highest-level credential for licensed professionals with a master's degree. Signifies advanced clinical expertise in diagnosis, treatment planning, and therapeutic intervention — ideal for supervisory, clinical, or leadership roles.", req: "Master's degree, 180 hours of education in alcohol and drug counseling, and 2,000 hours of supervised work experience." },
  { code: "CCS", name: "Certified Clinical Supervisor", desc: "For experienced addiction professionals who provide oversight, mentorship, and clinical guidance to other counselors. Validates high-level competence in supervision, leadership, and program development.", req: "Current AODA credential at the reciprocal level or higher, 10,000 hours of counseling experience (adjusted by degree level), 4,000 hours of clinical supervisory experience, and 30 hours of education specific to clinical supervision." },
  { code: "CCJP", name: "Certified Criminal Justice Professional", desc: "For professionals working at the intersection of the criminal justice and substance use treatment systems — correctional settings, courts, and community supervision programs.", req: "Specific educational and experiential requirements aligned with the criminal justice and substance abuse fields — contact ABCAC for details." },
  { code: "CPRS", name: "Certified Peer Recovery Specialist", desc: "For individuals with lived experience in recovery who support others on their journey. Emphasizes advocacy, mentoring, recovery support, and ethical practice.", req: "High school diploma or GED, 46 hours of education in advocacy, mentoring, recovery support, and ethics, and 500 hours of supervised practical experience." },
  { code: "CPS", name: "Certified Prevention Specialist", desc: "For professionals dedicated to preventing substance use and promoting community wellness through education, outreach, program planning, and policy advocacy.", req: "High school diploma or GED, 120 hours of prevention-specific education (including 6 hours of ethics), 2,000 hours of supervised prevention experience, and 120 hours of direct supervision." },
];

const steps = [
  "Choose the credential that matches your goals.",
  "Complete the general and supplemental application forms.",
  "Submit your documents through the ABCAC portal (preferred) or by email.",
  "Pay your application & exam fee.",
  "Schedule your exam through Prometric after pre-registration (watch for an email from SMT within 7 days — check your spam).",
];

export default function InitialCertificationPage() {
  const full = getProductBySlug("initial-certification-full-application-exam-fee");
  const remote = getProductBySlug("initial-certification-full-application-exam-fee-remote-proctored-exam");
  const certOnly = getProductBySlug("certification-certification-only-fee-already-passed-icrc-exam");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-6 py-16 md:grid-cols-[1fr_1.35fr] md:px-10 md:py-24 lg:px-16">
          {/* Left: copy */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-strong">
              Initial Certification
            </p>
            <h1>Take Your First Step Toward Certification</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              If you&apos;re applying for certification for the first time, ABCAC makes the process clear and
              accessible. Each credential includes clear requirements, step-by-step application guidance, and access
              to study materials and exam registration.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="/account/apply" size="lg" className="w-full sm:w-auto">Begin Your Application</CtaButton>
              <CtaButton href="/store" variant="outline" size="lg" className="w-full sm:w-auto">Visit the Store</CtaButton>
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

          {/* Right: hero image placeholder with maroon arc accent */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full border-[6px] border-brand/70 md:-right-6 md:h-36 md:w-36"
            />
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-bg shadow-lg ring-1 ring-black/5">
              <Image
                src="/brand/initial-cert-hero.png"
                alt="Initial ABCAC certification"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <Section title="The application process">
        <ol className="max-w-3xl space-y-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5 text-muted">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {full && <CtaButton href={`/store/${full.slug}`} className="w-full sm:w-auto">Full Application &amp; Exam — <PriceTag product={full} className="ml-1 text-white" /></CtaButton>}
          {remote && <CtaButton href={`/store/${remote.slug}`} variant="outline" className="w-full sm:w-auto">Remote Proctored Option</CtaButton>}
        </div>
        <p className="mt-4 text-sm text-muted">
          Already passed the IC&RC exam?{" "}
          {certOnly && (
            <CtaButton href={`/store/${certOnly.slug}`} variant="ghost" size="sm">Certification-only fee</CtaButton>
          )}
        </p>
        <div className="mt-8 rounded-xl border border-line bg-bg p-5">
          <p className="text-muted">Already paid? Submit your application and documents online.</p>
          <CtaButton href="/account/apply" variant="outline" className="mt-3 w-full sm:w-auto">Begin Your Application</CtaButton>
        </div>
      </Section>

      <Section surface eyebrow="Credentials" title="Explore your certification path">
        <div className="grid gap-5 md:grid-cols-2">
          {credentials.map((c) => (
            <div key={c.code} className="rounded-xl border border-line bg-bg p-6">
              <h3 className="text-base">{c.code} — {c.name}</h3>
              <p className="mt-2 text-sm text-muted">{c.desc}</p>
              <p className="mt-3 text-sm"><span className="font-semibold text-ink">Requirements:</span> <span className="text-muted">{c.req}</span></p>
            </div>
          ))}
        </div>
      </Section>

      <Section compact>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h3>Submitting your documents</h3>
          <p className="mt-2 text-muted">
            For the fastest processing, submit your completed certification documents through the ABCAC portal.
            Alternatively, email your documents to{" "}
            <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a>{" "}
            — include your full name and the credential you're applying for in the subject line. Questions? Call{" "}
            <a href={siteConfig.contact.phoneHref} className="font-semibold text-brand">{siteConfig.contact.phone}</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
