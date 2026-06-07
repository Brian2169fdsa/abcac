import type { Metadata } from "next";
import Image from "next/image";
import { Award, ClipboardCheck, RefreshCw, Globe, CheckCircle2 } from "lucide-react";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { CtaButton } from "@/components/cta-button";
import { FaqAccordion } from "@/components/faq-accordion";
import { getProductBySlug } from "@/lib/catalog";
import { PriceTag } from "@/components/price-tag";
import { siteConfig } from "@/lib/site-config";
import { FAQS, TESTIMONIALS } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "ABCAC — Arizona Board for Certification of Addiction Counselors",
  description:
    "Setting the Standard for Addiction Counselor Certification in Arizona. Apply for initial certification, renew credentials, register for IC&RC exams, and explore reciprocity.",
  openGraph: {
    title: "ABCAC — Arizona Board for Certification of Addiction Counselors",
    description:
      "Setting the Standard for Addiction Counselor Certification in Arizona. Apply for initial certification, renew credentials, register for IC&RC exams, and explore reciprocity.",
    url: "/",
  },
};

const stats = [
  { value: "1200+", label: "Certified Professionals in Arizona", sublabel: "And growing every year across clinical, prevention, and peer support domains." },
  { value: "57", label: "IC&RC Member Boards", sublabel: "Through IC&RC, ABCAC offers credential reciprocity with boards in 57 U.S. and international jurisdictions." },
  { value: "100%", label: "Ethics Compliance Rate", sublabel: "Maintained among active certificate holders since 2022." },
  { value: "$150", label: "Standard Recertification Fee", sublabel: "Keep your credentials active affordably every two years." },
];

const services = [
  { icon: Award, title: "Certification & Credentialing", description: "Apply for initial certification in addiction counseling, peer recovery, prevention, or supervision, recognized by IC&RC.", href: "/initial-certification" },
  { icon: ClipboardCheck, title: "Exam Registration & Support", description: "ABCAC provides IC&RC certification exams and supports licensure testing through AZBBHE.", href: "/testing" },
  { icon: RefreshCw, title: "Recertification & Continuing Education", description: "Maintain your credentials with clear recertification pathways and access to endorsed CEU opportunities.", href: "/certification-renewal" },
  { icon: Globe, title: "Reciprocity", description: "Move your credential to Arizona or transfer to another IC&RC member board with our streamlined reciprocity services.", href: "/reciprocity" },
];

const credentials = [
  { code: "CAC – Certified Addiction Counselor", desc: "For entry-level professionals working directly with clients in addiction recovery." },
  { code: "AADC – Advanced Counselor", desc: "For master's-level clinicians with advanced practice skills." },
  { code: "CPRS – Peer Recovery", desc: "For individuals in recovery who want to support others as certified peers." },
  { code: "CCJP / CPS / CCS", desc: "Criminal Justice, Prevention, or Supervision tracks." },
];

export default function HomePage() {
  const sync = getProductBySlug("certification-sync");
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-6 py-16 md:grid-cols-[1fr_1.35fr] md:px-10 md:py-24 lg:px-16">
          {/* Left: copy */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-strong">
              Certification &amp; Testing Support
            </p>
            <h1>{siteConfig.tagline}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Apply for initial certification, renew your credentials, register for IC&amp;RC exams, earn
              CEUs, and transfer your credential through reciprocity. One trusted place for Arizona&apos;s
              addiction counseling professionals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaButton href="/choose-your-cert-path" size="lg">Choose Your Cert Path</CtaButton>
              <CtaButton href="/store" variant="outline" size="lg">Visit the Store</CtaButton>
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
            {/* Decorative maroon arc, top-right of the image */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-6 h-28 w-28 rounded-full border-[6px] border-brand/70 md:-right-6 md:h-36 md:w-36"
            />
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-bg shadow-lg ring-1 ring-black/5">
              <Image
                src="/brand/hero-v2.png"
                alt="Arizona addiction counseling professionals reviewing certification materials"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <Section compact>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </Section>

      {/* Services */}
      <Section eyebrow="What we do" title="Certification services for every stage of your career" surface>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <ServiceCard key={s.title} {...s} linkLabel="Learn more" />
          ))}
        </div>
      </Section>

      {/* Why it matters */}
      <section className="bg-info text-white">
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-12 px-6 py-16 md:grid-cols-2 md:px-10 md:py-24 lg:px-16">
          {/* Left: copy */}
          <div>
            <div className="mb-4 h-1 w-10 rounded bg-brand" aria-hidden />
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">Why It Matters</p>
            <h2 className="text-white">Why Addiction Counselors Matter</h2>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              Addictions counselors help people reclaim their lives from substance use disorders. They provide
              support, education, and treatment planning to individuals, families, and communities. Whether working
              in hospitals, recovery centers, or private practice, these professionals guide clients through one of
              the most important transformations of their lives.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Support, education, and treatment planning",
                "Serving individuals, families, and communities",
                "Working in hospitals, recovery centers, and private practice",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 font-semibold text-white">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-white" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: image with on-brand stylized overlay */}
          <div className="relative mx-auto w-full max-w-md">
            {/* Gold offset frame, top-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-3 -top-3 h-full w-full rounded-2xl border border-accent/50"
            />
            {/* Maroon arc accent, bottom-left */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full border-[6px] border-brand/70"
            />
            {/* Image card */}
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-xl ring-1 ring-white/10">
              <Image
                src="/brand/why-counselors.png"
                alt="ABCAC certified addiction counselor"
                fill
                sizes="(max-width: 768px) 100vw, 28rem"
                className="object-cover"
              />
              {/* Navy blend + maroon tint overlay */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-info/70 via-info/10 to-transparent" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand/25 to-transparent mix-blend-multiply" />
            </div>
          </div>
        </div>
      </section>

      {/* Credential teaser */}
      <Section eyebrow="Credentials" title="Which Credential Is Right for You?" intro="Whether you're just starting out, advancing your clinical skills, or supporting others through lived experience — ABCAC offers the credential that aligns with your path." surface>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {credentials.map((c) => (
            <div key={c.code} className="rounded-xl border border-line bg-bg p-6">
              <h3 className="text-base">{c.code}</h3>
              <p className="mt-2 text-sm text-muted">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <CtaButton href="/initial-certification" variant="outline">Explore all credentials</CtaButton>
        </div>
      </Section>

      {/* Sync CTA */}
      <Section>
        <div className="rounded-xl border border-line bg-brand p-8 text-white md:p-12">
          <h2 className="text-white">Sync Your Certifications — One Date, One Renewal, Less Stress.</h2>
          <p className="mt-4 max-w-3xl text-white/85">
            Align the renewal dates of your CADAC, CCJP, AADC, or other ABCAC certifications into one easy, unified
            cycle. For just $15 per month forward, you can eliminate staggered renewals and manage all your
            certifications together — saving time, reducing hassle, and staying compliant.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <CtaButton href="/store/certification-sync" variant="accent" size="lg">Start Your Sync Now</CtaButton>
            {sync && <PriceTag product={sync} className="text-xl text-white" />}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Count the months you need to move forward to align your certifications.",
              "Enter that quantity when prompted (e.g., 5 months = $75).",
              "Complete your payment securely online.",
              "After payment, upload your completed sync form to finalize your request.",
            ].map((step, i) => (
              <div key={i} className="rounded-xl bg-white/10 p-4">
                <div className="font-display text-lg font-bold text-accent">Step {i + 1}</div>
                <p className="mt-1 text-sm text-white/85">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Digital certificate notice */}
      <Section compact surface>
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
          <h3>Certification Delivery Update</h3>
          <p className="mt-2 text-muted">
            ABCAC is transitioning to a digital certificate system. Paper copies of certificates will no longer be
            automatically mailed — all recipients receive an official digital certificate upon approval or renewal. A
            printed copy can be requested for a $25 processing and mailing fee. Questions? Contact our office at{" "}
            <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a>{" "}
            or submit your request through the ABCAC portal.
          </p>
        </div>
      </Section>

      {/* Testimonials */}
      <Section eyebrow="Testimonials" title="What people say about us">
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="flex h-full flex-col rounded-xl border border-line bg-surface p-6">
              <blockquote className="flex-1 text-muted">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-ink">— {t.author}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <section className="bg-info text-white">
        <div className="mx-auto w-full max-w-content px-5 py-16 md:px-8 md:py-24">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">Questions</p>
            <h2 className="text-white">Frequently Asked Questions</h2>
          </div>
          <FaqAccordion items={FAQS} />
          <div className="mt-8 text-center">
            <CtaButton href="/faq">See all FAQs</CtaButton>
          </div>
        </div>
      </section>

      {/* Become a Board Member */}
      <Section compact>
        <div className="rounded-xl border border-line bg-bg p-8 md:flex md:items-center md:justify-between md:gap-8">
          <div className="max-w-2xl">
            <h3>Become an ABCAC Board Member</h3>
            <p className="mt-2 text-muted">
              If you possess expertise in behavioral or mental health, we extend a warm invitation for you to join our
              board of directors. Your insights are invaluable.
            </p>
          </div>
          <CtaButton href="/contact" className="mt-4 md:mt-0">Express Interest</CtaButton>
        </div>
      </Section>
    </>
  );
}
