import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Code of Ethics",
  description: "Core ethical commitments expected of ABCAC applicants, certificate holders, and portal users.",
};

const commitments = [
  ["Protect clients and the public", "Place client welfare, safety, dignity, and public protection above personal or organizational gain."],
  ["Practice within competence", "Provide services only within the boundaries of education, training, supervised experience, credentials, and applicable law."],
  ["Act with honesty and integrity", "Represent qualifications, credentials, services, records, billing, and professional relationships truthfully."],
  ["Respect confidentiality", "Protect private information and disclose it only with valid authorization or when law and safety obligations require disclosure."],
  ["Maintain professional boundaries", "Avoid exploitation, discrimination, harassment, conflicts of interest, and relationships that impair professional judgment."],
  ["Support equity and cultural responsiveness", "Provide respectful services without discrimination and pursue continuing growth in cultural awareness and humility."],
  ["Maintain professional fitness", "Address impairment, seek appropriate support, and refrain from practice when health or conduct could place others at risk."],
  ["Cooperate with accountability processes", "Respond accurately and promptly to lawful audits, ethics reviews, credential verification, and requests for records."],
];

export default function CodeOfEthicsPage() {
  return (
    <>
      <section className="bg-info text-white">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Professional standards</p>
          <h1 className="mt-3 text-white">ABCAC Code of Ethics</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/70">Applicants and certificate holders are expected to protect the public, practice honestly, and uphold the ethical standards applicable to their credential and professional role.</p>
        </div>
      </section>
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">
          <div className="grid gap-5 md:grid-cols-2">
            {commitments.map(([title, text]) => (
              <article key={title} className="rounded-2xl border border-line bg-bg p-6">
                <CheckCircle2 className="h-6 w-6 text-brand" aria-hidden />
                <h2 className="mt-4 text-xl">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-brand/15 bg-brand/[0.05] p-6">
            <h2 className="text-2xl">Reporting and review</h2>
            <p className="mt-3 leading-relaxed text-muted">Ethics concerns should include enough factual information for ABCAC to understand the conduct and determine the appropriate review path. Filing a concern does not itself establish a violation. ABCAC may request additional information and applies the governing credential and ethics procedures.</p>
            <p className="mt-3 text-muted">Contact <a href={siteConfig.contact.emailHref} className="font-semibold text-brand">{siteConfig.contact.email}</a> or {siteConfig.contact.phone} for the current complaint process or applicable full standards.</p>
          </div>
        </div>
      </section>
    </>
  );
}
