import type { Metadata } from "next";
import { ShieldCheck, Clock, Mail } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { VerifyForm } from "@/components/verify-form";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Verify a Certification",
  description:
    "Employers, agencies, and boards can request verification of an Arizona Board for Certification of Addiction Counselors (ABCAC) credential.",
};

export default function VerifyPage() {
  const c = siteConfig.contact;
  return (
    <>
      <PageHero
        eyebrow="Certification verification"
        title="Verify a Certification"
        intro="Employers, agencies, and credentialing boards can request confirmation of an ABCAC-certified counselor's standing. Submit the request below and our team will respond by email."
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-line bg-surface p-7">
            <VerifyForm />
          </div>
          <div className="space-y-6">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <p className="text-muted">
                We confirm whether the named counselor holds a valid {siteConfig.shortName} certification.
              </p>
            </div>
            <div className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <p className="text-muted">
                Most requests are reviewed within a few business days. You will receive the outcome by email.
              </p>
            </div>
            <div className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <a href={c.emailHref} className="text-muted hover:text-brand">
                {c.email}
              </a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
