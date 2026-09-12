import type { Metadata } from "next";
import Image from "next/image";
import {
  Award,
  BadgeCheck,
  ClipboardCheck,
  RefreshCw,
  Globe,
  CheckCircle2,
  Phone,
  Sparkles,
  ShieldCheck,
  Quote,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { CtaButton } from "@/components/cta-button";
import { FaqSection } from "@/components/faq-section";
import { BlogCard } from "@/components/blog/blog-card";
import { siteConfig } from "@/lib/site-config";
import { FAQS, TESTIMONIALS } from "@/lib/faqs";
import { getPostSummaries } from "@/lib/blog";

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
  { icon: Award, title: "Certification & Credentialing", description: "Apply for initial certification in addiction counseling, peer recovery, prevention, or supervision, recognized by IC&RC.", href: "/initial-certification", linkLabel: "Go to Certification Page" },
  { icon: ClipboardCheck, title: "Exam Registration & Support", description: "ABCAC provides IC&RC certification exams and supports licensure testing through AZBBHE.", href: "/testing", linkLabel: "Go to Testing Page" },
  { icon: RefreshCw, title: "Recertification & Continuing Education", description: "Maintain your credentials with clear recertification pathways and access to endorsed CEU opportunities.", href: "/certification-renewal", linkLabel: "Go to Renewal Page" },
  { icon: Globe, title: "Reciprocity Transfers", description: "Move your credential to Arizona or transfer to another IC&RC member board with our streamlined reciprocity services.", href: "/reciprocity", linkLabel: "Go to Reciprocity Page" },
];

const credentials = [
  { code: "CAC – Certified Addiction Counselor", desc: "For entry-level professionals working directly with clients in addiction recovery." },
  { code: "CADAC – Alcohol & Drug Abuse Counselor", desc: "For experienced counselors specializing in alcohol and drug abuse treatment." },
  { code: "AADC – Advanced Counselor", desc: "For master's-level clinicians with advanced practice skills." },
  { code: "CPRS – Peer Recovery", desc: "For individuals in recovery who want to support others as certified peers." },
  { code: "CCJP / CPS / CCS", desc: "Criminal Justice, Prevention, or Supervision tracks." },
];

export default function HomePage() {
  const latestPosts = getPostSummaries().slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[calc(100svh-4.875rem)] items-center overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.07]" aria-hidden />
        <div className="site-grid absolute inset-0 -z-10 opacity-55" aria-hidden />
        <div className="absolute -right-40 -top-52 -z-10 h-[34rem] w-[34rem] rounded-full bg-brand/[0.08] blur-3xl" aria-hidden />
        <div className="absolute -bottom-44 left-1/3 -z-10 h-80 w-80 rounded-full bg-info/[0.06] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[94rem] items-center gap-10 px-5 py-10 sm:px-8 sm:py-12 md:grid-cols-[1.02fr_0.98fr] md:gap-12 lg:px-12 lg:py-14 xl:px-16">
          {/* Left: copy */}
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden />
              {siteConfig.trustLine}
            </div>
            <p className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-accent-strong">
              <span className="h-px w-8 bg-brand" aria-hidden />
              Certification &amp; Testing Support
            </p>
            <h1 className="max-w-[18ch] text-[clamp(2.6rem,3.65vw,3.85rem)] leading-[0.98] tracking-[-0.045em]">{siteConfig.tagline}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-[1.05rem]">
              Apply for initial certification, renew your credentials, register for IC&amp;RC exams, earn
              CEUs, and transfer your credential through reciprocity. One trusted place for Arizona&apos;s
              addiction counseling professionals.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="/initial-certification" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">Initial Certification</CtaButton>
              <CtaButton href="/certification-renewal" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Renew Certification</CtaButton>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2.5 text-sm font-semibold text-ink">
              {["IC&RC Recognized", "Arizona Based", "1,200+ Certified"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 fill-brand/10 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: hero image with maroon arc accent */}
          <div className="relative mx-auto w-full max-w-2xl md:pr-3">
            {/* Decorative maroon arc, top-right of the image */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-5 -top-7 h-28 w-28 rounded-full border-[8px] border-brand/15 md:-right-8 md:h-40 md:w-40"
            />
            <div className="absolute -bottom-5 -left-5 h-24 w-24 rounded-[1.75rem] bg-info shadow-xl" aria-hidden />
            <div className="relative rounded-[2.2rem] border border-info/10 bg-surface/70 p-2.5 shadow-[0_40px_95px_-42px_rgba(13,34,63,0.58)] backdrop-blur">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[1.7rem] bg-info">
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
            <div className="absolute -bottom-5 right-3 flex min-w-[15rem] items-center gap-3 rounded-2xl border border-brand/10 bg-white/95 px-4 py-3 shadow-2xl shadow-info/20 backdrop-blur sm:right-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 ring-1 ring-brand/10">
                <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">IC&amp;RC Member Board</div>
                <div className="mt-0.5 text-xs font-medium text-slate-600">Credentials built for reciprocity</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New credential announcement */}
      <Section compact className="bg-surface">
        <div className="flex flex-col gap-5 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.06] to-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.08] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
              New Credential · IC&amp;RC PR-A Reciprocal
            </span>
            <h3 className="mt-3">Certified Peer Recovery Specialist–Associate (CPRS-A)</h3>
            <p className="mt-2 max-w-2xl text-muted">
              Arizona&apos;s entry-level peer credential. No degree and no experience hours required — and your
              training and supervised practice count toward the full CPRS.
            </p>
          </div>
          <CtaButton href="/initial-certification#cprs-a" size="lg" className="shrink-0 whitespace-nowrap">
            Learn about the CPRS-A <ArrowRight className="h-4 w-4" aria-hidden />
          </CtaButton>
        </div>
      </Section>

      {/* Stat band */}
      <section className="relative z-10 px-4 pb-14 pt-6 sm:-mt-5 sm:px-6 sm:pt-0 lg:-mt-7 lg:px-8">
        <div className="mx-auto grid w-full max-w-content gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </section>

      {/* Services */}
      <Section
        eyebrow="Our services"
        title="Certification services for every stage of your career"
        intro="Clear pathways, trusted standards, and practical support from your first application through every renewal."
        className="bg-gradient-to-b from-surface to-bg/50"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <ServiceCard key={s.title} {...s} />
          ))}
        </div>
      </Section>

      {/* Why it matters */}
      <section className="relative isolate overflow-hidden bg-info text-white">
        <div className="site-noise absolute inset-0 -z-20" aria-hidden />
        <div className="absolute -left-40 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl" aria-hidden />
        <div className="absolute right-0 top-0 -z-10 h-full w-1/2 bg-gradient-to-l from-white/[0.04] to-transparent" aria-hidden />
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-12 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-2 md:gap-16 md:px-10 lg:px-12 lg:py-28">
          {/* Left: copy */}
          <div>
            <div className="mb-5 h-1 w-12 rounded-full bg-brand" aria-hidden />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Why It Matters</p>
            <h2 className="max-w-xl text-white">Why Addiction Counselors Matter</h2>
            <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
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
                <li key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/[0.08]">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: image with on-brand stylized overlay */}
          <div className="relative mx-auto w-full max-w-lg">
            {/* Gold offset frame, top-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-4 h-full w-full rounded-3xl border border-white/20"
            />
            {/* Maroon arc accent, bottom-left */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full border-[8px] border-brand/70"
            />
            {/* Image card */}
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-white/5 shadow-2xl ring-1 ring-white/10">
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
      <Section eyebrow="Credentials" title="Which Credential Is Right for You?" intro="Whether you're just starting out, advancing your clinical skills, or supporting others through lived experience — ABCAC offers the credential that aligns with your path." className="bg-surface">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-5">
          {credentials.map((c, index) => (
            <div key={c.code} className="group modern-surface relative overflow-hidden rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1.5 hover:border-brand/20 hover:shadow-[0_28px_70px_-38px_rgba(13,34,63,0.4)] sm:p-6 lg:p-5">
              <span className="pointer-events-none absolute right-4 top-3 font-display text-5xl font-bold text-brand opacity-[0.045]" aria-hidden>0{index + 1}</span>
              <span className="relative mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-sm font-bold text-brand ring-1 ring-brand/10">0{index + 1}</span>
              <h3 className="text-base leading-snug">{c.code}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <CtaButton href="/initial-certification" variant="outline">Explore all credentials</CtaButton>
        </div>
      </Section>

      {/* Certification Sync feature */}
      <section className="relative isolate overflow-hidden border-y border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.08]" aria-hidden />
        <div className="absolute -right-28 -top-36 -z-10 h-96 w-96 rounded-full border-[56px] border-brand/[0.06]" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-24 xl:px-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand">
              <RefreshCw className="h-4 w-4" aria-hidden /> One date. One renewal cycle.
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Certification management</p>
            <h2 className="mt-3 max-w-[15ch] text-[clamp(2.5rem,5vw,4.35rem)] tracking-[-0.04em]">Sync Your ABCAC Certifications</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">Align staggered ABCAC credential expiration dates into one easier renewal cycle. Pay a one-time $15 fee for each month an earlier credential moves forward.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <CtaButton href="/certification-sync" size="lg" className="w-full justify-center sm:w-auto">Explore Certification Sync</CtaButton>
              <CtaButton href="/certification-sync#calculator" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Calculate Your Fee</CtaButton>
            </div>
            <div className="mt-7 grid gap-3 text-sm font-semibold text-ink sm:grid-cols-3">
              {["One-time payment", "$15 per month moved", "ABCAC review included"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />{item}</span>)}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full border-8 border-brand/10" aria-hidden />
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-white p-4 shadow-2xl shadow-info/15 sm:p-7">
              <Image src="/brand/cadac-certificate.png" alt="Sample ABCAC certification displayed for renewal-date synchronization" fill sizes="(max-width: 1024px) 100vw, 48vw" className="object-contain p-4 sm:p-8" />
            </div>
            <div className="absolute -bottom-5 right-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 shadow-xl">
              <BadgeCheck className="h-7 w-7 text-brand" aria-hidden />
              <div><p className="text-sm font-bold text-ink">Simpler credential management</p><p className="text-xs text-muted">Fewer renewal dates to track</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Digital certificate notice */}
      <Section compact className="bg-surface">
        <div className="flex flex-col gap-5 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.06] to-surface p-6 sm:flex-row sm:p-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/20">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h3>Certification Delivery Update</h3>
            <p className="mt-2 text-muted">
            ABCAC is transitioning to a digital certificate system. Beginning immediately, paper copies of certificates
            will no longer be automatically mailed. All certification recipients will receive an official digital
            certificate upon approval or renewal.
            </p>
            <p className="mt-3 text-muted">
            If you would like a printed copy of your certificate, one can be requested for a $25 processing and mailing
            fee. If you have questions, contact our office at{" "}
            <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a>{" "}
            or submit your request through the ABCAC portal.
            </p>
            <p className="mt-3 text-muted">
            This change allows ABCAC to deliver certificates faster, reduce administrative processing time, and support
            environmentally responsible practices.
            </p>
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section eyebrow="Testimonials" title="What people say about us" intro="Real experiences from professionals who trusted ABCAC with their certification journey." className="bg-surface">
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-bg p-6 shadow-[0_18px_50px_-36px_rgba(13,34,63,0.4)] sm:p-7">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-info" aria-hidden />
              <Quote className="mb-5 h-8 w-8 fill-brand/10 text-brand" aria-hidden />
              <blockquote className="flex-1 leading-relaxed text-muted">“{t.quote}”</blockquote>
              <figcaption className="mt-5 border-t border-line pt-4 text-sm font-semibold text-ink">— {t.author}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Knowledge Center */}
      <Section
        id="knowledge-center"
        eyebrow="Knowledge Center"
        title="Practical guidance for your certification journey"
        intro="Current, plain-language resources for Arizona addiction professionals—from choosing a credential and preparing for testing to maintaining certification and strengthening practice."
        className="overflow-hidden border-y border-line bg-gradient-to-b from-bg to-surface"
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {latestPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaButton href="/blog" size="lg">Explore the Knowledge Center</CtaButton>
          <p className="text-sm leading-relaxed text-muted">
            Browse all articles on certification, testing, ethics, treatment, and career growth.
          </p>
        </div>
      </Section>

      <FaqSection
        eyebrow="ABCAC FAQ"
        title="Frequently Asked Questions"
        items={FAQS}
        intro="Straight answers to the questions Arizona certification candidates ask most."
        actions={<CtaButton href="/faq">See all FAQs</CtaButton>}
      />

      {/* Become a Board Member */}
      <Section className="bg-bg">
        <div className="relative overflow-hidden rounded-3xl border border-brand/10 bg-surface p-6 shadow-[0_30px_80px_-50px_rgba(13,34,63,0.55)] sm:p-8 md:p-12">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand/[0.05] blur-2xl" aria-hidden />
          <div className="grid items-center gap-10 md:grid-cols-2">
            {/* Left: text + button */}
            <div>
              <h2>Become an ABCAC Board Member</h2>
              <p className="mt-4 text-lg text-muted">
                If you possess expertise in behavioral or mental health, we extend a warm invitation for you to join
                our board of directors. Your insights are invaluable, and your leadership helps shape the future of
                addiction counselor certification in Arizona.
              </p>
              <CtaButton href="/board-application" size="lg" className="mt-6 shadow-lg shadow-brand/20">Apply Now</CtaButton>
            </div>
            {/* Right: image with on-brand stylized overlay */}
            <div className="relative mx-auto w-full max-w-md">
              {/* Gold offset frame, top-right */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-3 -top-3 h-full w-full rounded-3xl border border-brand/20"
              />
              {/* Maroon arc accent, bottom-left */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-5 -left-5 h-24 w-24 rounded-full border-[6px] border-brand/70"
              />
              {/* Image card */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-info/20">
                <Image
                  src="/brand/board-member.png"
                  alt="Expand your impact as an ABCAC board member"
                  fill
                  sizes="(max-width: 768px) 100vw, 28rem"
                  className="object-cover"
                />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand/15 to-transparent mix-blend-multiply" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden bg-gradient-to-r from-brand-600 via-brand to-brand-600 text-white">
        <div className="absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full border-[40px] border-white/[0.05]" aria-hidden />
        <div className="absolute -bottom-24 left-1/3 -z-10 h-48 w-48 rounded-full bg-white/[0.05] blur-xl" aria-hidden />
        <div className="mx-auto flex w-full max-w-content flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center md:px-8 md:py-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/75">Ready for your next step?</p>
            <h2 className="mt-1 text-white">Get certified today!</h2>
          </div>
          <a
            href={siteConfig.contact.phoneHref}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand transition-colors hover:bg-bg"
          >
            <Phone className="h-5 w-5" aria-hidden />
            Call now · {siteConfig.contact.phone}
          </a>
        </div>
      </section>
    </>
  );
}
