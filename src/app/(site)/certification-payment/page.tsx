import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, CheckCircle2, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Initial Certification Payment",
  description:
    "Compare ABCAC initial certification payment options for in-person testing, remote-proctored testing, or certification-only processing.",
};

const options = [
  {
    slug: "initial-certification-full-application-exam-fee",
    eyebrow: "In-Person Testing",
    title: "Application + In-Person Exam",
    description: "For first-time applicants testing at an approved Arizona testing center.",
    button: "Continue with In-Person Package",
    featured: false,
  },
  {
    slug: "initial-certification-full-application-exam-fee-remote-proctored-exam",
    eyebrow: "Most Flexible",
    title: "Application + Remote Exam",
    description: "For first-time applicants who prefer a secure remote-proctored IC&RC exam.",
    button: "Continue with Remote Package",
    featured: true,
  },
  {
    slug: "certification-certification-only-fee-already-passed-icrc-exam",
    eyebrow: "Exam Already Complete",
    title: "Certification-Only Processing",
    description: "For applicants who already passed the applicable IC&RC exam.",
    button: "Continue with Certification Only",
    featured: false,
  },
];

export default function CertificationPaymentPage() {
  const products = options
    .map((option) => ({ ...option, product: getProductBySlug(option.slug) }))
    .filter((option) => option.product);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.07]" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand">
              <LockKeyhole className="h-4 w-4" aria-hidden />
              Secure Stripe checkout
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Initial Certification Fees</p>
            <h1 className="mt-3 max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Choose the payment that matches your path</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Submit your application documents before paying. Then select the package that matches your exam plan and review the total before continuing to Stripe.
            </p>
            <CtaButton href="#payment-options" size="lg" className="mt-7 w-full justify-center sm:w-auto">Compare Payment Options <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
          </div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-line bg-info shadow-[0_30px_70px_-38px_rgba(13,34,63,0.55)]">
            <Image
              src="/brand/credential-counselors.png"
              alt="Arizona addiction counseling professionals reviewing certification materials"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-info/45 via-transparent to-transparent" aria-hidden />
          </div>
        </div>
      </section>

      <section id="payment-options" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Payment Options</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Select one certification package</h2>
            <p className="mt-4 text-lg text-muted">Each package opens a review page before secure checkout. ABCAC begins processing after your documents and payment are received.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {products.map(({ product, eyebrow, title, description, button, featured }) => (
              <article
                key={product!.slug}
                className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-surface p-6 shadow-[0_24px_60px_-45px_rgba(13,34,63,0.5)] sm:p-7 ${featured ? "border-brand/30 ring-4 ring-brand/[0.06]" : "border-line"}`}
              >
                {featured && <span className="absolute right-5 top-5 rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Recommended</span>}
                <p className="pr-24 text-xs font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
                <h3 className="mt-4 text-2xl">{title}</h3>
                <PriceTag product={product!} className="mt-4 text-4xl text-brand" />
                <p className="mt-4 leading-relaxed text-muted">{description}</p>
                <ul className="mt-6 flex-1 space-y-3 border-t border-line pt-5 text-sm text-muted">
                  {product!.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton href="/account/certification" size="lg" className="mt-7 w-full justify-center">{button}</CtaButton>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[80rem] gap-6 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 lg:px-10 lg:py-20">
          <div className="rounded-3xl border border-line bg-bg p-6 sm:p-8">
            <FileCheck2 className="h-7 w-7 text-brand" aria-hidden />
            <h2 className="mt-5 text-2xl">Before you pay</h2>
            <ul className="mt-5 space-y-3 text-muted">
              <li>Complete the general and credential-specific application manuals.</li>
              <li>Upload your education, experience, and supporting documentation.</li>
              <li>Confirm whether your exam will be in person, remote, or already completed.</li>
            </ul>
            <CtaButton href="/initial-certification#credentials" variant="outline" className="mt-6">Review Applications</CtaButton>
          </div>
          <div className="rounded-3xl bg-info p-6 text-white sm:p-8">
            <ShieldCheck className="h-7 w-7 text-white" aria-hidden />
            <h2 className="mt-5 text-2xl text-white">How secure payment works</h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Your package review page sends you to Stripe Checkout. Stripe securely collects card details; ABCAC receives the payment status and links the receipt to your member account.
            </p>
            <p className="mt-4 text-sm text-white/60">Do not email card numbers or include payment details in uploaded documents.</p>
          </div>
        </div>
      </section>
    </>
  );
}
