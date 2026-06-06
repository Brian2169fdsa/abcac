import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
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
      <PageHero
        eyebrow="Initial Certification"
        title="Take Your First Step Toward Certification"
        intro="If you're applying for certification for the first time, ABCAC makes the process clear and accessible. Each credential includes clear requirements, step-by-step application guidance, and access to study materials and exam registration."
      />

      <Section title="The application process">
        <ol className="max-w-3xl space-y-3">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5 text-muted">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          {full && <CtaButton href={`/store/${full.slug}`}>Full Application & Exam — <PriceTag product={full} className="ml-1 text-white" /></CtaButton>}
          {remote && <CtaButton href={`/store/${remote.slug}`} variant="outline">Remote Proctored Option</CtaButton>}
        </div>
        <p className="mt-4 text-sm text-muted">
          Already passed the IC&RC exam?{" "}
          {certOnly && (
            <CtaButton href={`/store/${certOnly.slug}`} variant="ghost" size="sm">Certification-only fee</CtaButton>
          )}
        </p>
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
