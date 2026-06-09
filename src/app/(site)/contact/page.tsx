import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { ContactForm } from "@/components/contact-form";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact the Arizona Board for Certification of Addiction Counselors. We will get back to you as soon as possible.",
};

export default function ContactPage() {
  const c = siteConfig.contact;
  return (
    <>
      <PageHero eyebrow="Get in touch" title="Contact Us" intro="Contact us any time. We will get back to you as soon as possible." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-7">
            <ContactForm />
          </div>
          <div className="space-y-5">
            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <address className="not-italic text-muted">
                {c.org}
                <br />
                {c.addressLine}
                <br />
                {c.cityStateZip}
              </address>
            </div>
            <div className="flex gap-3">
              <Phone className="h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <a href={c.phoneHref} className="text-muted hover:text-brand">{c.phone}</a>
            </div>
            <div className="flex gap-3">
              <Mail className="h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
              <a href={c.emailHref} className="text-muted hover:text-brand">{c.email}</a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
