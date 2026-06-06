import Image from "next/image";
import { Award, ClipboardCheck, RefreshCw, Globe } from "lucide-react";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { CtaButton } from "@/components/cta-button";
import { TrustBadge } from "@/components/trust-badge";
import { getProductBySlug } from "@/lib/catalog";
import { PriceTag } from "@/components/price-tag";
import { siteConfig } from "@/lib/site-config";

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
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-content items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">{siteConfig.shortName}</p>
            <h1>{siteConfig.tagline}</h1>
            <p className="mt-4 text-lg text-muted">{siteConfig.trustLine}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaButton href="/choose-your-cert-path" size="lg">Choose Your Cert Path</CtaButton>
              <CtaButton href="/store" variant="outline" size="lg">Visit the Store</CtaButton>
            </div>
            <div className="mt-8 max-w-md">
              <TrustBadge />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-bg">
            <Image
              src="/brand/abcac-logo.jpg"
              alt="Arizona Board for Certification of Addiction Counselors"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-6"
            />
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
    </>
  );
}
