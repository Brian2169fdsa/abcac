import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Award, ClipboardCheck, RefreshCw, Globe } from "lucide-react";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { CtaButton } from "@/components/cta-button";
import { TrustBadge } from "@/components/trust-badge";
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
        {/* Maroon half-circle decorative element, top-right */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand md:-right-32 md:-top-32 md:h-96 md:w-96"
        />
        <div className="relative mx-auto flex w-full max-w-content flex-col items-center px-5 py-16 text-center md:px-8 md:py-24">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-strong">{siteConfig.shortName}</p>
          <h1 className="max-w-3xl">{siteConfig.tagline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{siteConfig.trustLine}</p>

          {/* Hero image — rounded corners, centered. Swap /brand/hero.svg → /brand/hero.jpg once the real banner is added. */}
          <Link
            href="/choose-your-cert-path"
            className="group relative mx-auto mt-10 block aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-bg shadow-lg ring-1 ring-black/5"
          >
            <Image
              src="/brand/hero.svg"
              alt="Certification pathways for Arizona addiction counseling professionals"
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </Link>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <CtaButton href="/choose-your-cert-path" size="lg">Choose Your Cert Path</CtaButton>
            <CtaButton href="/store" variant="outline" size="lg">Visit the Store</CtaButton>
          </div>
          <div className="mt-8 w-full max-w-md">
            <TrustBadge />
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
      <Section title="Why Addiction Counselors Matter">
        <p className="max-w-3xl text-lg text-muted">
          Addictions counselors help people reclaim their lives from substance use disorders. They provide support,
          education, and treatment planning to individuals, families, and communities. Whether working in hospitals,
          recovery centers, or private practice, these professionals guide clients through one of the most important
          transformations of their lives.
        </p>
      </Section>

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
      <Section eyebrow="Questions" title="Frequently Asked Questions" surface>
        <div className="mx-auto max-w-3xl divide-y divide-line">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5">
              <h3 className="text-base">{f.q}</h3>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <CtaButton href="/faq" variant="outline">See all FAQs</CtaButton>
        </div>
      </Section>

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
