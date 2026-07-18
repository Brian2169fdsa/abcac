import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Mail,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { FaqSection } from "@/components/faq-section";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Initial Certification",
  description:
    "Apply for initial ABCAC certification — eligibility, credential levels, application steps, document submission, payment, and IC&RC exam registration.",
};

const credentials = [
  {
    code: "CAC",
    name: "Certified Addiction Counselor",
    description:
      "Designed for professionals beginning their career in addiction counseling. The CAC validates foundational knowledge in substance use disorders, behavioral sciences, and practical counseling experience.",
    requirements:
      "High school diploma or GED, 200–250 hours of addiction and behavioral sciences education, and 2 years or 4,000 hours of work experience.",
    application: "General application plus the CAC supplemental application.",
    forms: [
      { label: "General Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-General-manual-.pdf" },
      { label: "CAC Supplemental Application", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-CAC-CADAC-AADC-Supplemental-manual.pdf" },
    ],
    imagePosition: "0% 0%",
    tone: "bg-brand",
  },
  {
    code: "CADAC",
    name: "Certified Alcohol & Drug Abuse Counselor",
    description:
      "Recognizes advanced competency in assessment, treatment planning, and client care for professionals with a bachelor’s degree and extensive addiction-counseling experience.",
    requirements:
      "Bachelor’s degree, 200 hours of addiction and counseling studies, and 3 years or 6,000 hours of work experience.",
    application: "General application plus the CADAC supplemental application.",
    forms: [
      { label: "General Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-General-manual-.pdf" },
      { label: "CADAC Supplemental Application", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-CAC-CADAC-AADC-Supplemental-manual-27032384.pdf" },
    ],
    imagePosition: "50% 0%",
    tone: "bg-info",
  },
  {
    code: "AADC",
    name: "Advanced Alcohol & Drug Counselor",
    description:
      "ABCAC’s highest-level counseling credential for licensed professionals with advanced clinical expertise in diagnosis, treatment planning, and therapeutic intervention.",
    requirements:
      "Master’s degree, 180 hours of education in alcohol and drug counseling, and 2,000 hours of supervised work experience.",
    application: "General application plus the AADC supplemental application.",
    forms: [
      { label: "General Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-General-manual-.pdf" },
      { label: "AADC Supplemental Application", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-CAC-CADAC-AADC-Supplemental-manual-27032384.pdf" },
    ],
    imagePosition: "100% 0%",
    tone: "bg-success",
  },
  {
    code: "CPRS",
    name: "Certified Peer Recovery Specialist",
    description:
      "For individuals with lived recovery experience who support others through advocacy, mentoring, recovery support, and ethical peer-based guidance.",
    requirements:
      "High school diploma or GED, 46 hours of education in advocacy, mentoring, recovery support, and ethics, and 500 hours of supervised practical experience.",
    application: "Certified Peer Recovery Specialist application.",
    forms: [
      { label: "CPRS Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-CPRS-Application-Manual.pdf" },
    ],
    imagePosition: "0% 50%",
    tone: "bg-[#6B2A91]",
  },
  {
    code: "CCS",
    name: "Certified Clinical Supervisor",
    description:
      "For experienced addiction professionals who provide oversight, mentorship, and clinical guidance while supporting quality care and workforce development.",
    requirements:
      "A current reciprocal-level AODA credential, qualifying counseling experience, 4,000 hours of clinical supervisory experience, and 30 hours of clinical-supervision education.",
    application: "Certified Clinical Supervisor application.",
    forms: [
      { label: "CCS Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/The-Clinical-Supervisor-Manual-1.pdf" },
    ],
    imagePosition: "50% 50%",
    tone: "bg-[#386FA4]",
  },
  {
    code: "CCJP",
    name: "Certified Criminal Justice Professional",
    description:
      "For professionals providing addiction services within correctional settings, courts, community supervision programs, and other justice-involved systems.",
    requirements:
      "Education and experience aligned with criminal justice and substance-use treatment. Contact ABCAC for credential-specific guidance.",
    application: "Certified Criminal Justice Professional application.",
    forms: [
      { label: "CCJP Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/CCJP-Manual.pdf" },
    ],
    imagePosition: "100% 50%",
    tone: "bg-[#527A16]",
  },
  {
    code: "CPS",
    name: "Certified Prevention Specialist",
    description:
      "For professionals preventing substance use and promoting community wellness through education, outreach, program planning, and policy advocacy.",
    requirements:
      "High school diploma or GED, 120 hours of prevention-specific education including 6 ethics hours, 2,000 hours of supervised prevention experience, and 120 hours of direct supervision.",
    application: "Certified Prevention Specialist application.",
    forms: [
      { label: "CPS Application Manual", href: "https://irp.cdn-website.com/249de5f7/files/uploaded/Prevention-Specialist-Manual-1-3.pdf" },
    ],
    imagePosition: "0% 100%",
    tone: "bg-[#4D78B5]",
  },
];

const processSteps = [
  {
    icon: GraduationCap,
    title: "Choose your credential",
    text: "Compare the seven ABCAC pathways and select the credential that matches your education, experience, and career goals.",
  },
  {
    icon: ClipboardCheck,
    title: "Complete your application",
    text: "Provide your contact details, credential type, testing preference, location, accommodations, and AZBBHE approval information.",
  },
  {
    icon: Upload,
    title: "Submit your documents",
    text: "Upload the general and credential-specific forms, education records, experience verification, and supporting documents.",
  },
  {
    icon: CreditCard,
    title: "Pay the correct fee",
    text: "Choose in-person testing, remote-proctored testing, or certification-only processing if you already passed the IC&RC exam.",
  },
  {
    icon: BadgeCheck,
    title: "Review and exam scheduling",
    text: "ABCAC reviews your completed file. When testing applies, watch for an SMT scheduling email within 7 days and check your spam folder.",
  },
];

const initialFaqs = [
  {
    q: "Who should apply for initial certification?",
    a: "Anyone applying for an ABCAC credential for the first time should use the initial certification process. Choose the credential that best matches your education, work experience, and professional role.",
  },
  {
    q: "What is the cost for initial certification?",
    a: "The standard full application and in-person IC&RC exam package is $375. The remote-proctored package is $425, and certification-only processing is $150 for applicants who already passed the applicable IC&RC exam.",
  },
  {
    q: "What are the requirements to apply?",
    a: "Requirements vary by credential and may include education hours, supervised work experience, a degree, current credentials, or lived recovery experience. Review the credential cards on this page before applying.",
  },
  {
    q: "Is the IC&RC exam included in the $375 fee?",
    a: "Yes, the standard $375 full application package includes the applicable IC&RC exam at an approved Arizona testing center. Remote proctoring is available through the separate $425 package.",
  },
  {
    q: "How do I submit my application?",
    a: "Use the secure member portal to complete the application and upload supporting documents. If needed, documents may also be emailed to abcac@abcac.org with your full name and credential in the subject line.",
  },
  {
    q: "How long does the certification process take?",
    a: "Timing depends on whether your application and supporting documents are complete. Review begins after ABCAC receives the required materials and payment. Exam candidates should watch for an SMT scheduling email within 7 days after pre-registration.",
  },
] as const;

export default function InitialCertificationPage() {
  const full = getProductBySlug("initial-certification-full-application-exam-fee");
  const remote = getProductBySlug("initial-certification-full-application-exam-fee-remote-proctored-exam");
  const certOnly = getProductBySlug("certification-certification-only-fee-already-passed-icrc-exam");

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.06]" aria-hidden />
        <div className="absolute -right-40 -top-44 -z-10 h-[32rem] w-[32rem] rounded-full bg-brand/[0.08] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              IC&amp;RC-recognized credentials
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Initial Certification</p>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Take Your First Step Toward Certification</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              ABCAC makes initial certification clear and accessible with straightforward requirements, guided application steps, study resources, and exam-registration support.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#credentials" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">
                Begin Your Application <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href="#credentials" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Explore Credentials</CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["Seven credential paths", "Online document upload", "Exam support included"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 fill-brand/10 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-3xl">
            <div className="pointer-events-none absolute -right-6 -top-7 h-32 w-32 rounded-full border-[8px] border-brand/15 md:h-40 md:w-40" aria-hidden />
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-white/80 bg-info shadow-[0_32px_75px_-30px_rgba(13,34,63,0.5)] ring-1 ring-info/10">
              <Image
                src="/brand/initial-cert-hero.png"
                alt="ABCAC initial certification guidance"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.95fr_1.05fr] md:gap-14 lg:px-10 lg:py-24">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-45px_rgba(13,34,63,0.45)]">
            <div className="relative aspect-[1.3/1]">
              <Image src="/brand/credential-counselors.png" alt="Arizona addiction counseling professionals collaborating during certification training" fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Explore Your Certification Path</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Professional credentials for every stage of your career</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              ABCAC offers credentials in addiction counseling, recovery support, prevention, criminal justice, and clinical supervision. Each pathway includes clear requirements, application guidance, study-material direction, and exam-registration support.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Select the credential that matches your goals and let ABCAC guide you from your first application through document review, payment, and exam-day success.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Application Process</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">A clear path from application to exam</h2>
            <p className="mt-4 text-lg text-muted">Complete each step in order to avoid delays and keep your certification review moving.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative rounded-2xl border border-line bg-bg p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                    <span className="font-display text-3xl font-semibold text-brand/15">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="credentials" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Certification Information</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Find the credential that fits your work</h2>
            <p className="mt-4 text-lg text-muted">Review the education and experience requirements before starting your online application.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {credentials.map((credential) => (
              <article key={credential.code} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_45px_-38px_rgba(13,34,63,0.5)] transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div className={`h-1.5 ${credential.tone}`} />
                <div className="relative h-44 overflow-hidden bg-info">
                  <div
                    className="absolute inset-0 bg-[length:300%_300%] bg-no-repeat transition-transform duration-500 group-hover:scale-105"
                    style={{
                      backgroundImage: "url('/brand/credential-pathways-atlas.png')",
                      backgroundPosition: credential.imagePosition,
                    }}
                    aria-hidden
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-info/45 via-transparent to-transparent" aria-hidden />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand">{credential.code}</span>
                    <BadgeCheck className="h-6 w-6 text-brand/35 transition-colors group-hover:text-brand" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-xl">{credential.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{credential.description}</p>
                  <div className="mt-5 space-y-4 border-t border-line pt-5 text-sm">
                    <div>
                      <div className="font-semibold text-ink">Requirements</div>
                      <p className="mt-1 leading-relaxed text-muted">{credential.requirements}</p>
                    </div>
                    <div>
                      <div className="font-semibold text-ink">Application</div>
                      <p className="mt-1 leading-relaxed text-muted">{credential.application}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {credential.forms.map((form) => (
                        <a
                          key={form.href}
                          href={form.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/[0.05] px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                        >
                          <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
                          {form.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl bg-info p-6 text-white sm:p-8 md:grid-cols-3">
            {[
              { icon: FileCheck2, title: "Application guidance", text: "Complete the general and credential-specific forms, upload required documents, and submit payment." },
              { icon: BookOpen, title: "Study materials", text: "Use recommended textbooks, online courses, and practice exams for your credential and IC&RC exam." },
              { icon: Clock3, title: "Exam information", text: "Schedule through Prometric after pre-registration and watch for an SMT email within 7 days." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                  <Icon className="h-6 w-6 text-white" aria-hidden />
                  <h3 className="mt-4 text-lg text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:px-12 lg:py-24">
          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Upload className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl text-white">Submit your documentation</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              The fastest process is to submit your completed application and supporting documents through the secure member portal. Make sure every file is clear, complete, and labeled with your full name.
            </p>
            <p className="mt-4 leading-relaxed text-white/70">
              You may also email documents to <a href={siteConfig.contact.emailHref} className="font-semibold text-white underline underline-offset-4">{siteConfig.contact.email}</a>. Include your full name and credential in the subject line. Questions? Call <a href={siteConfig.contact.phoneHref} className="font-semibold text-white underline underline-offset-4">{siteConfig.contact.phone}</a>.
            </p>
            <CtaButton href="/account/apply" size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">Upload Documents &amp; Apply</CtaButton>
            <CtaButton href="#payment-options" variant="outline" size="lg" className="mt-3 w-full border-white text-white hover:bg-white hover:text-info sm:w-auto">View Secure Payment Options</CtaButton>
          </div>

          <div id="payment-options" className="scroll-mt-28 rounded-3xl border border-line bg-bg p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Application &amp; Exam Fees</p>
            <h2 className="mt-3 text-3xl">Already submitted your documentation?</h2>
            <p className="mt-4 text-muted">Choose the payment option that matches your testing plan. Payment confirms your intent to complete the certification process and starts official review and scheduling.</p>
            <CtaButton href="/certification-payment" size="lg" className="mt-6 w-full justify-center">Open Secure Payment Page <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {full && (
                <div className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                  <h3 className="text-base">Application + In-Person Exam</h3>
                  <PriceTag product={full} className="mt-3 text-2xl font-semibold text-brand" />
                  <p className="mt-3 flex-1 text-sm text-muted">Full application processing and IC&amp;RC exam at an approved Arizona testing center.</p>
                  <CtaButton href={`/store/${full.slug}`} className="mt-5 w-full">Pay In-Person Fee</CtaButton>
                </div>
              )}
              {remote && (
                <div className="flex flex-col rounded-2xl border border-brand/20 bg-surface p-5 shadow-lg shadow-brand/5">
                  <h3 className="text-base">Application + Remote Exam</h3>
                  <PriceTag product={remote} className="mt-3 text-2xl font-semibold text-brand" />
                  <p className="mt-3 flex-1 text-sm text-muted">Full application processing with a secure remote-proctored IC&amp;RC exam.</p>
                  <CtaButton href={`/store/${remote.slug}`} className="mt-5 w-full">Pay Remote Fee</CtaButton>
                </div>
              )}
              {certOnly && (
                <div className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                  <h3 className="text-base">Certification Only</h3>
                  <PriceTag product={certOnly} className="mt-3 text-2xl font-semibold text-brand" />
                  <p className="mt-3 flex-1 text-sm text-muted">For applicants who already passed the applicable IC&amp;RC exam.</p>
                  <CtaButton href={`/store/${certOnly.slug}`} variant="outline" className="mt-5 w-full">Pay Certification Fee</CtaButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 md:gap-14 lg:px-10 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Help Shape the Profession</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Become an ABCAC Board Member</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">If you possess expertise in behavioral or mental health, we warmly invite you to apply to join the ABCAC Board of Directors. Your insight and leadership can help shape the future of addiction-counselor certification in Arizona.</p>
            <CtaButton href="/board-application" size="lg" className="mt-7 w-full sm:w-auto">Express Interest <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_26px_65px_-42px_rgba(13,34,63,0.5)]">
            <Image src="/brand/board-member.png" alt="Professionals collaborating as ABCAC board members" fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
          </div>
        </div>
      </section>

      <FaqSection
        eyebrow="Initial Certification FAQ"
        title="Answers before you apply"
        intro="Review the most common questions about eligibility, pricing, submission, and timing."
        items={initialFaqs}
      />

      <section className="relative overflow-hidden bg-info text-white">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-10 lg:py-16">
          <div>
            <h2 className="text-3xl text-white">Ready to begin your certification?</h2>
            <p className="mt-2 text-white/70">Create your application, upload your documents, and let ABCAC guide the next step.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaButton href="/account/apply" size="lg" className="w-full sm:w-auto">Begin Your Application</CtaButton>
            <CtaButton href="/contact" variant="outline" size="lg" className="w-full border-white text-white hover:bg-white hover:text-info sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Contact ABCAC</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
