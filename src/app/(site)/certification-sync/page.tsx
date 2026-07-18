import type { Metadata } from "next";
import Image from "next/image";
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { CertificationSyncCalculator } from "@/components/certification-sync-calculator";
import { CtaButton } from "@/components/cta-button";
import { FaqSection } from "@/components/faq-section";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Certification Sync",
  description:
    "Align multiple ABCAC certification renewal dates into one unified cycle with a one-time $15 fee for each month moved forward.",
};

const syncFaqs = [
  {
    q: "Is Certification Sync a monthly subscription?",
    a: "No. The $15 amount is a one-time fee for each month a credential must move forward. For example, a six-month adjustment is a one-time $90 payment.",
  },
  {
    q: "Which renewal date becomes my unified date?",
    a: "ABCAC reviews the active credentials and requested alignment before confirming the resulting renewal cycle. Do not assume a date change is complete until ABCAC confirms it.",
  },
  {
    q: "Does syncing replace my renewal requirements?",
    a: "No. Certification Sync aligns dates only. You must still satisfy the continuing education, ethics, documentation, and renewal requirements for each credential.",
  },
  {
    q: "How do I calculate the number of months?",
    a: "Count the months from the earlier renewal date to the target renewal date. If you are unsure, contact ABCAC before paying so the quantity can be confirmed.",
  },
  {
    q: "What happens after payment?",
    a: "ABCAC matches your payment to the completed sync request, reviews the credential dates, and confirms the updated cycle after processing.",
  },
];

const steps = [
  {
    icon: FileCheck2,
    title: "Confirm your credentials",
    text: "Gather each active ABCAC credential number and current expiration date. Certification Sync is most useful when you maintain two or more credentials.",
  },
  {
    icon: CalendarCheck2,
    title: "Confirm the month difference",
    text: "Count how many months the earlier credential must move forward. Contact ABCAC before paying if the correct quantity is unclear.",
  },
  {
    icon: CircleDollarSign,
    title: "Complete one-time payment",
    text: "Pay $15 for each month moved forward. Enter the number of months as the checkout quantity—not as a recurring monthly plan.",
  },
  {
    icon: Upload,
    title: "Submit your sync request",
    text: "Sign in to upload the completed request and supporting credential details. ABCAC confirms the new cycle after review.",
  },
];

export default function CertificationSyncPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.08]" aria-hidden />
        <div className="absolute -right-28 -top-36 -z-10 h-96 w-96 rounded-full border-[56px] border-brand/[0.06]" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-24 xl:px-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand">
              <RefreshCw className="h-4 w-4" aria-hidden />
              One date. One renewal cycle.
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Certification management</p>
            <h1 className="mt-3 max-w-[15ch] text-[clamp(2.65rem,5vw,4.7rem)] tracking-[-0.04em]">Sync Your ABCAC Certifications</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              Align staggered ABCAC credential expiration dates into one easier renewal cycle. You pay a one-time $15 fee for each month an earlier credential is moved forward.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <CtaButton href="#calculator" size="lg" className="w-full justify-center sm:w-auto">Calculate Your Fee</CtaButton>
              <CtaButton href="/account/documents" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Upload Sync Documents</CtaButton>
            </div>
            <div className="mt-7 grid gap-3 text-sm font-semibold text-ink sm:grid-cols-3">
              {["One-time payment", "$15 per month moved", "ABCAC review included"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full border-8 border-brand/10" aria-hidden />
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-white p-4 shadow-2xl shadow-info/15 sm:p-7">
              <Image
                src="/brand/cadac-certificate.png"
                alt="Sample ABCAC certification displayed for renewal-date synchronization"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 48vw"
                className="object-contain p-4 sm:p-8"
              />
            </div>
            <div className="absolute -bottom-5 right-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-xl">
              <BadgeCheck className="h-7 w-7 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-bold text-ink">Simpler credential management</p>
                <p className="text-xs text-muted">Fewer renewal dates to track</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">What this service does</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Move staggered dates into one cycle</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Certification Sync adjusts the earlier expiration date of eligible active ABCAC credentials so they can renew together. It reduces duplicate reminders and separate renewal deadlines.
            </p>
            <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-5">
              <p className="font-bold text-ink">Important: the service aligns dates only.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">It does not waive CEUs, ethics training, renewal forms, credential-specific standards, or approval requirements.</p>
            </div>
          </div>
          <div id="calculator" className="scroll-mt-28">
            <CertificationSyncCalculator />
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">A clear four-step process</h2>
            <p className="mt-4 text-lg text-muted">Prepare the credential details first, then pay only after the month difference is confirmed.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="relative overflow-hidden rounded-2xl border border-line bg-bg p-6">
                <span className="absolute right-4 top-2 text-6xl font-bold text-brand/[0.05]" aria-hidden>0{index + 1}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaButton href="/account/documents" size="lg" className="w-full justify-center sm:w-auto">Upload Completed Request</CtaButton>
            <CtaButton href={siteConfig.contact.emailHref} variant="outline" size="lg" className="w-full justify-center sm:w-auto">Ask ABCAC to Confirm Months</CtaButton>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-3 lg:px-12 lg:py-20">
          {[
            { icon: ShieldCheck, title: "Review before adjustment", text: "ABCAC reviews the request and payment before confirming any renewal-date change." },
            { icon: CalendarCheck2, title: "One easier date to track", text: "Approved credentials can share one renewal cycle instead of staggered expiration dates." },
            { icon: BadgeCheck, title: "Standards remain intact", text: "Every credential keeps its applicable CEU, ethics, renewal, and documentation requirements." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-surface p-6">
              <item.icon className="h-7 w-7 text-brand" aria-hidden />
              <h3 className="mt-4 text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <FaqSection
        eyebrow="Certification Sync FAQ"
        title="Questions before you sync"
        intro="Confirm the quantity before checkout and contact ABCAC whenever two credential dates do not align cleanly by month."
        items={syncFaqs}
        actions={<CtaButton href={siteConfig.contact.emailHref} size="lg" className="bg-white text-info hover:bg-white/90">Contact ABCAC</CtaButton>}
      />
    </>
  );
}
