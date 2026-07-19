import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  Globe2,
  GraduationCap,
  Mail,
  RefreshCw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { FaqSection } from "@/components/faq-section";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Certification Renewal",
  description:
    "Renew your ABCAC credential every two years with continuing education documentation, a complete renewal application, and the standard renewal fee.",
};

const processSteps = [
  {
    icon: CalendarCheck2,
    title: "Confirm your renewal date",
    text: "ABCAC credentials renew every two years. Start early enough to gather CE certificates and complete your packet before expiration.",
  },
  {
    icon: GraduationCap,
    title: "Complete required education",
    text: "Include Ethics, Cultural Diversity, and continuing education in the field of your current certification.",
  },
  {
    icon: ClipboardCheck,
    title: "Complete your renewal packet",
    text: "Use the renewal track that matches your credential and update your contact, certification, and supervised-hours information when applicable.",
  },
  {
    icon: Upload,
    title: "Submit supporting documents",
    text: "Upload your completed renewal application and clear copies of every required CE certificate through the member portal.",
  },
  {
    icon: CreditCard,
    title: "Pay the renewal fee",
    text: "Complete the standard two-year renewal payment through ABCAC’s secure Stripe checkout to begin final processing.",
  },
];

const renewalTracks = [
  {
    code: "CAC · CADAC · AADC",
    title: "Counselor Recertification",
    description: "For Certified Addiction Counselor, Certified Alcohol & Drug Abuse Counselor, and Advanced Alcohol & Drug Counselor credentials.",
    formHref: "/forms/library/recert-cac-cadac-aadc.pdf",
    workflowKey: "renewal:counselor",
    tone: "bg-info",
  },
  {
    code: "CPS",
    title: "Prevention Specialist Recertification",
    description: "For professionals renewing the Certified Prevention Specialist credential and prevention-focused continuing education.",
    formHref: "/forms/library/recert-cps.pdf",
    workflowKey: "renewal:cps",
    tone: "bg-success",
  },
  {
    code: "CCS",
    title: "Clinical Supervisor Recertification",
    description: "For Certified Clinical Supervisors maintaining advanced supervision, ethics, and professional-development requirements.",
    formHref: "/forms/library/recert-ccs.pdf",
    workflowKey: "renewal:ccs",
    tone: "bg-brand",
  },
  {
    code: "CCJP",
    title: "Criminal Justice Professional Recertification",
    description: "For professionals renewing a credential focused on addiction services in criminal-justice and community-supervision settings.",
    formHref: "/forms/library/recert-ccjp.pdf",
    workflowKey: "renewal:ccjp",
    tone: "bg-[#6B2A91]",
  },
  {
    code: "CPRS",
    title: "Peer Recovery Specialist Recertification",
    description: "For Certified Peer Recovery Specialists documenting continued education in peer support, advocacy, ethics, and recovery services.",
    formHref: "/forms/library/recert-cprs.pdf",
    workflowKey: "renewal:cprs",
    tone: "bg-[#A24922]",
  },
];

const renewalFaqs = [
  {
    q: "How often do I need to renew my certification?",
    a: "All ABCAC credentials renew every two years. Review your certificate expiration date and begin gathering your renewal documents before that date.",
  },
  {
    q: "What is the renewal fee?",
    a: "The standard fee is $150 for a new two-year ABCAC credential. Payment is processed through ABCAC’s secure Stripe checkout.",
  },
  {
    q: "What are the requirements for certification renewal?",
    a: "Renewal requires Ethics and Cultural Diversity education plus continuing education in the appropriate field of your certification. Credential-specific or supervised-hour information may also be required.",
  },
  {
    q: "What documents do I need for renewal?",
    a: "Submit the renewal application for your credential, copies of your CE certificates, your certification number, current contact information, and any other credential-specific documentation requested by ABCAC.",
  },
  {
    q: "What if my certification expires before I renew?",
    a: "Contact ABCAC as soon as possible. Staff can explain the options that apply to your credential and whether additional reinstatement steps are required.",
  },
  {
    q: "Where do I submit my renewal materials?",
    a: "Use the secure member portal to submit the renewal application and CE certificates. If portal submission is unavailable, email abcac@abcac.org for assistance and alternate submission instructions.",
  },
] as const;

export default function CertificationRenewalPage() {
  const renewal = getProductBySlug("certification-renewal-2-year-credential-renewal-fee");
  const sync = getProductBySlug("certification-sync");

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.06]" aria-hidden />
        <div className="absolute -right-40 -top-44 -z-10 h-[32rem] w-[32rem] rounded-full bg-brand/[0.08] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Two-year credential renewal
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Certification Renewal</p>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Stay Current. Stay Certified.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Maintain your ABCAC credential with a clear renewal path for continuing education, documentation, secure payment, and final review.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#renewal-tracks" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">
                Start Your Renewal <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href="#renewal-requirements" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Review Requirements</CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["Renew every two years", "Ethics + Cultural Diversity", "Secure Stripe payment"].map((item) => (
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
                src="/brand/renewal-hero.png"
                alt="ABCAC certification renewal guidance"
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
              <Image src="/brand/cadac-certificate.png" alt="Example renewed ABCAC certification document" fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Renew and Maintain Your Credential</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Continued professional excellence starts with staying current</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Renewal keeps your certification active and recognized while supporting accountability and continued growth in addiction counseling, peer recovery, prevention, criminal justice, and clinical supervision.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Submit your continuing education, confirm any required supervised hours, update your contact information, and complete payment through one organized process.
            </p>
            <p className="mt-5 font-semibold text-ink">Stay certified. Stay connected. Stay ready to serve.</p>
          </div>
        </div>
      </section>

      <section id="renewal-tracks" className="scroll-mt-24 bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Renewal Process</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Five steps to keep your credential active</h2>
            <p className="mt-4 text-lg text-muted">Prepare the complete renewal file before payment to reduce delays during review.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-2xl border border-line bg-bg p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
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

      <section id="renewal-requirements" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Certification Information</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Know what your renewal package needs</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                Include continuing education in the appropriate field of your credential and clear copies of every CE certificate with your renewal application.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: BookOpenCheck, title: "Ethics education", text: "Include completed Ethics continuing education for the current renewal cycle." },
                { icon: Users, title: "Cultural Diversity", text: "Include Cultural Diversity education as part of your continuing-education documentation." },
                { icon: FileCheck2, title: "Credential-field CE", text: "Submit continuing education relevant to counseling, prevention, peer support, justice, or supervision." },
                { icon: BadgeCheck, title: "Credential details", text: "Provide your certification number, current information, and any required supervised-hours documentation." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-line bg-surface p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                    <h3 className="mt-4 text-lg">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-8 flex gap-3 rounded-2xl border border-brand/15 bg-brand/[0.05] p-5 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
            <p><strong className="text-ink">Important:</strong> HIV/AIDS education is required for initial certification only and is not required for recertification.</p>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Renewal Tracks</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Prepare the packet for your credential</h2>
            <p className="mt-4 text-lg text-muted">Please select the appropriate recertification form for your current credential. Download and complete the form, then continue to the submission section below to upload your documents and submit payment.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {renewalTracks.map((track) => (
              <article key={track.code} className="group overflow-hidden rounded-2xl border border-line bg-bg shadow-[0_18px_45px_-38px_rgba(13,34,63,0.5)] transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div className={`h-1.5 ${track.tone}`} />
                <div className="flex h-full flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand">{track.code}</span>
                    <RefreshCw className="h-6 w-6 text-brand/35 transition-colors group-hover:text-brand" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-xl">{track.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{track.description}</p>
                  <CtaButton href={`/account/forms?workflow=${encodeURIComponent(track.workflowKey)}`} className="mt-5 w-full">Complete Digitally <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
                  <CtaButton href={track.formHref} variant="outline" className="mt-3 w-full">Download Paper Form <FileCheck2 className="h-4 w-4" aria-hidden /></CtaButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="submit-renewal" className="scroll-mt-24 bg-bg">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-24">
          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Upload className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl text-white">Submit your renewal documentation</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Upload your completed recertification form and Continuing Education Unit certificates through the secure renewal form. Make sure every file is clear, complete, and labeled with your full name to avoid processing delays.
            </p>
            <ol className="mt-5 space-y-3 text-sm leading-relaxed text-white/75">
              <li><strong className="text-white">1. Name:</strong> Enter your full name exactly as it appears on your certification.</li>
              <li><strong className="text-white">2. File upload:</strong> Upload your completed renewal packet and all required CE certificates.</li>
              <li><strong className="text-white">3. Certification number:</strong> Enter your current certification number so the team can identify your record.</li>
            </ol>
            <p className="mt-5 leading-relaxed text-white/70">Once every field is complete, submit the form to send your documents to ABCAC. Questions? Email <a href={siteConfig.contact.emailHref} className="font-semibold text-white underline underline-offset-4">{siteConfig.contact.email}</a>.</p>
            <CtaButton href="/account/forms" size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">Open Digital Forms Center</CtaButton>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Secure Renewal Payment</p>
                <h2 className="mt-3 text-3xl">Already submitted your documentation?</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success"><ShieldCheck className="h-4 w-4" aria-hidden /> Stripe checkout</span>
            </div>
            <p className="mt-4 text-muted">Complete payment after submitting your renewal materials. Payment confirms your intent to renew and allows ABCAC to begin final processing.</p>
            {renewal && (
              <div className="mt-7 rounded-2xl border border-brand/20 bg-bg p-6">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <h3>Two-Year Credential Renewal</h3>
                    <PriceTag product={renewal} className="mt-2 text-3xl font-semibold text-brand" />
                    <p className="mt-2 max-w-xl text-sm text-muted">Includes renewal application processing, CE-document review, and issuance of a new two-year credential when approved.</p>
                  </div>
                  <CtaButton href="/account/certification" size="lg" className="w-full shrink-0 sm:w-auto">Pay Renewal Fee</CtaButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-5 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 lg:px-12 lg:py-24">
          <div className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><RefreshCw className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl">Sync multiple credentials</h2>
            <p className="mt-4 leading-relaxed text-muted">Align multiple ABCAC certification renewal dates into one unified cycle. Certification Sync reduces staggered deadlines and keeps credential management easier.</p>
            {sync && (
              <CtaButton href="/certification-sync" variant="outline" size="lg" className="mt-7 w-full sm:w-auto">Explore Certification Sync — <PriceTag product={sync} /> per month moved</CtaButton>
            )}
          </div>

          <div className="rounded-3xl bg-info p-7 text-white sm:p-9">
            <div className="flex items-center justify-between gap-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Globe2 className="h-6 w-6" aria-hidden /></span>
              <div className="rounded-xl bg-white px-3 py-2">
                <Image src="/brand/icrc-logo.png" alt="IC&RC" width={120} height={41} className="h-8 w-auto" />
              </div>
            </div>
            <h2 className="mt-6 text-3xl text-white">Request an IC&amp;RC International Certificate</h2>
            <p className="mt-4 leading-relaxed text-white/70">ABCAC processes International Certificate requests for eligible professionals holding a current IC&amp;RC-level credential. The international certificate is tied to your current credential and is not a stand-alone certification.</p>
            <CtaButton href="/contact" size="lg" className="mt-7 w-full sm:w-auto">Request Eligibility Information</CtaButton>
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
        eyebrow="Renewal FAQ"
        title="Answers before you renew"
        intro="Review the most common questions about timing, requirements, documents, and submission."
        items={renewalFaqs}
      />

      <section className="relative overflow-hidden bg-info text-white">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-10 lg:py-16">
          <div>
            <h2 className="text-3xl text-white">Ready to keep your credential active?</h2>
            <p className="mt-2 text-white/70">Prepare your renewal packet, upload your CE certificates, and complete secure payment.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaButton href="/account/certification" size="lg" className="w-full sm:w-auto">Start Your Renewal</CtaButton>
            <CtaButton href="/contact" variant="outline" size="lg" className="w-full border-white text-white hover:bg-white hover:text-info sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Contact ABCAC</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
