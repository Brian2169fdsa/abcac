import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Mail,
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
  title: "CEU Providers & Workshop Endorsement",
  description:
    "Maintain ABCAC continuing education provider status or submit an individual workshop for CEU endorsement using the appropriate review tier.",
};

const tierMeta = [
  {
    slug: "ceu-workshop-endorsement-up-to-8-contact-hours",
    hours: "8 contact hours or less",
    description: "Best for shorter workshops, focused seminars, and half-day continuing education programs.",
  },
  {
    slug: "ceu-workshop-endorsement-9-15-contact-hours",
    hours: "More than 8, up to 15 hours",
    description: "Designed for full-day, extended, or multi-part continuing education programs.",
  },
  {
    slug: "ceu-workshop-endorsement-more-than-15-contact-hours",
    hours: "More than 15 contact hours",
    description: "For comprehensive training series and longer professional-development programs.",
  },
];

const endorsementSteps = [
  {
    icon: ClipboardCheck,
    title: "Prepare the application",
    text: "Complete the provider workshop application and gather the workshop materials required for review.",
  },
  {
    icon: Clock3,
    title: "Confirm contact hours",
    text: "Calculate the total instructional contact hours and select the matching endorsement review tier.",
  },
  {
    icon: Upload,
    title: "Submit the materials",
    text: "Email the completed application and supporting materials to ABCAC before completing payment.",
  },
  {
    icon: CreditCard,
    title: "Pay through Stripe",
    text: "Use the secure checkout for the correct fee tier. Standard review turnaround is up to four weeks.",
  },
];

const ceuFaqs = [
  {
    q: "How many continuing education hours are required for certification renewal?",
    a: "Required hours vary by credential and renewal cycle. Review the renewal requirements for your specific ABCAC credential or contact the office before selecting courses.",
  },
  {
    q: "Are there specific topics that must be included in the CEU hours?",
    a: "Renewal documentation includes Ethics and Cultural Diversity education, along with continuing education relevant to the field of your certification.",
  },
  {
    q: "Can in-service training count toward the CEU requirement?",
    a: "In-service training may qualify when it meets ABCAC content and documentation standards. Keep the agenda, learning information, attendance verification, and completion certificate for review.",
  },
  {
    q: "Are online courses acceptable for CEU credit?",
    a: "Online education may be accepted when the provider, course content, contact hours, and completion documentation meet ABCAC requirements. Contact ABCAC if you are unsure before enrolling.",
  },
  {
    q: "How do I submit my CEU documentation for renewal?",
    a: "Submit CE certificates with your renewal application through the member portal. If online submission is unavailable, email abcac@abcac.org for alternate instructions.",
  },
  {
    q: "What happens if I do not complete the required CEUs before my certification expires?",
    a: "Contact ABCAC immediately. Staff can explain the options that apply to your credential and whether additional reinstatement steps are required.",
  },
] as const;

export default function CeuPage() {
  const annual = getProductBySlug("annual-credential-fee-approved-ceu-providers");

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.06]" aria-hidden />
        <div className="absolute -right-40 -top-44 -z-10 h-[32rem] w-[32rem] rounded-full bg-brand/[0.08] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <GraduationCap className="h-4 w-4" aria-hidden />
              Professional continuing education
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">CEU Providers &amp; Workshop Endorsement</p>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Advance the Field Through Quality Education</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Maintain approved CEU provider status or submit an individual workshop for ABCAC endorsement through a clear, standards-focused review process.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#provider-fee" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">Provider Annual Fee <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
              <CtaButton href="#workshop-endorsement" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Endorse a Workshop</CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["Professional standards review", "Clear fee tiers", "Four-week turnaround"].map((item) => (
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
                src="/brand/ceu-workshop-hero.png"
                alt="A professional continuing education workshop for behavioral-health professionals"
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
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Continuing Education</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">A standards-based path for providers and educators</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">ABCAC reviews continuing education opportunities to support high-quality professional development for addiction counselors and related professionals across Arizona.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-line bg-surface p-7 shadow-[0_20px_55px_-45px_rgba(13,34,63,0.5)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><BadgeCheck className="h-6 w-6" aria-hidden /></span>
              <h3 className="mt-6 text-2xl">Approved CEU Providers</h3>
              <p className="mt-3 leading-relaxed text-muted">Maintain active ABCAC provider status through annual credential maintenance, ongoing administrative oversight, compliance monitoring, and public provider-directory eligibility.</p>
              <CtaButton href="#provider-fee" variant="outline" className="mt-6 w-full sm:w-auto">Review Annual Requirements</CtaButton>
            </article>
            <article className="rounded-3xl border border-line bg-surface p-7 shadow-[0_20px_55px_-45px_rgba(13,34,63,0.5)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10 text-info"><Users className="h-6 w-6" aria-hidden /></span>
              <h3 className="mt-6 text-2xl">Individual Workshop Endorsement</h3>
              <p className="mt-3 leading-relaxed text-muted">Submit a specific workshop or training event for one-time review. The fee is based on total contact hours, and approval is required before advertising ABCAC endorsement.</p>
              <CtaButton href="#workshop-endorsement" variant="outline" className="mt-6 w-full sm:w-auto">View Endorsement Tiers</CtaButton>
            </article>
          </div>
        </div>
      </section>

      <section id="provider-fee" className="scroll-mt-24 bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Approved Provider Maintenance</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">CEU Provider Annual Credential Fee</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">All approved CEU providers submit an annual credential maintenance fee to retain active status with ABCAC. The payment is due each year on the anniversary of the provider’s initial approval date.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              {[
                { icon: ClipboardCheck, title: "Oversight", text: "Ongoing administrative review and credential maintenance." },
                { icon: ShieldCheck, title: "Compliance", text: "Monitoring that supports professional education standards." },
                { icon: Users, title: "Visibility", text: "Eligibility for inclusion in ABCAC’s approved-provider directory." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-line bg-bg p-5">
                    <Icon className="h-5 w-5 text-brand" aria-hidden />
                    <h3 className="mt-4 text-base">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-brand/20 bg-bg p-7 shadow-[0_24px_65px_-48px_rgba(13,34,63,0.5)] sm:p-9">
            <div className="flex items-center justify-between gap-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><CalendarCheck2 className="h-6 w-6" aria-hidden /></span>
              <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success"><ShieldCheck className="h-4 w-4" aria-hidden /> Stripe checkout</span>
            </div>
            <h3 className="mt-6 text-2xl">Annual CEU Provider Fee</h3>
            {annual && <PriceTag product={annual} className="mt-3 text-4xl font-semibold text-brand" />}
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Due annually on the initial approval anniversary.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Required to maintain active approved-provider status.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Nonpayment may result in removal from the active provider list.</li>
            </ul>
            {annual && <CtaButton href={`/account/payments?product=${annual.slug}`} size="lg" className="mt-7 w-full">Submit Annual Provider Fee</CtaButton>}
            <p className="mt-4 text-center text-xs text-muted">Questions? Call {siteConfig.contact.phone} or email {siteConfig.contact.email}.</p>
          </div>
        </div>
      </section>

      <section id="workshop-endorsement" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Workshop Endorsement</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Submit a workshop in four clear steps</h2>
            <p className="mt-4 text-lg text-muted">Each workshop or event is subject to a one-time review fee based on total contact hours.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {endorsementSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-2xl border border-line bg-surface p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
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

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {tierMeta.map((tier, index) => {
              const product = getProductBySlug(tier.slug);
              if (!product) return null;
              return (
                <article key={tier.slug} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_45px_-38px_rgba(13,34,63,0.5)]">
                  <div className={index === 0 ? "h-1.5 bg-info" : index === 1 ? "h-1.5 bg-brand" : "h-1.5 bg-success"} />
                  <div className="flex flex-1 flex-col p-6">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-brand">Endorsement Tier {index + 1}</span>
                    <h3 className="mt-3 text-xl">{tier.hours}</h3>
                    <PriceTag product={product} className="mt-4 text-3xl font-semibold text-brand" />
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{tier.description}</p>
                    <CtaButton href="/account/forms?workflow=ceu%3Aworkshop" className="mt-6 w-full">Apply With This Tier</CtaButton>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl bg-info p-6 text-white sm:p-8 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Approval before advertising", text: "Do not advertise a workshop as ABCAC-endorsed until formal approval has been issued." },
              { icon: CalendarCheck2, title: "Two-year presentation window", text: "There is no additional charge for repeat presentations of the same approved workshop for two years from the original date." },
              { icon: Clock3, title: "Four-week review", text: "Plan for a standard endorsement review turnaround of up to four weeks after a complete submission." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                  <Icon className="h-6 w-6" aria-hidden />
                  <h3 className="mt-4 text-lg text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-24">
          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><FileCheck2 className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl text-white">Submit your application materials</h2>
            <p className="mt-4 leading-relaxed text-white/70">Send the completed workshop endorsement application and supporting materials to ABCAC before paying the selected review tier. Include the provider contact, workshop title, total contact hours, and all required review documents.</p>
            <p className="mt-4 leading-relaxed text-white/70">Email submissions to <a href={siteConfig.contact.emailHref} className="font-semibold text-white underline underline-offset-4">{siteConfig.contact.email}</a>. Online provider submissions can move into the member portal as that workflow becomes available.</p>
            <CtaButton href="/account/forms?workflow=ceu%3Aworkshop" size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">Complete Workshop Form Digitally</CtaButton>
            <CtaButton href="/forms/library/ceu-workshop.pdf" variant="outline" size="lg" className="mt-3 w-full border-white text-white hover:bg-white hover:text-info sm:w-auto">Download Paper Form</CtaButton>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Submission Checklist</p>
            <h2 className="mt-3 text-3xl">Make the review easy to process</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {[
                "Completed workshop endorsement application",
                "Provider name and reliable contact information",
                "Workshop title and total contact hours",
                "Supporting workshop materials for review",
                "Correct Stripe endorsement tier payment",
                "Time for the standard four-week review period",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <FaqSection
        eyebrow="CEU FAQ"
        title="Continuing education questions"
        intro="Answers for credential holders, approved providers, and educators preparing workshops."
        items={ceuFaqs}
      />

      <section className="relative overflow-hidden bg-info text-white">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-10 lg:py-16">
          <div>
            <h2 className="text-3xl text-white">Ready to submit a CEU workshop?</h2>
            <p className="mt-2 text-white/70">Prepare the application, confirm the contact hours, and select the correct Stripe review tier.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaButton href="#workshop-endorsement" size="lg" className="w-full sm:w-auto">Choose a Fee Tier</CtaButton>
            <CtaButton href="/contact" variant="outline" size="lg" className="w-full border-white text-white hover:bg-white hover:text-info sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Contact ABCAC</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
