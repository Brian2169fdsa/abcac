import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Globe2,
  Mail,
  MapPinned,
  Scale,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "IC&RC Credentials, Exams & International Certificates",
  description:
    "Learn how ABCAC works with IC&RC to support internationally recognized credentialing standards, examinations, reciprocity, study resources, and International Certificates.",
};

const officialSite = "https://internationalcredentialing.org/";
const studyMaterials = "https://internationalcredentialing.org/prep-and-study-materials/";
const certificateForms = "https://internationalcredentialing.org/forms/";

const credentials = [
  { code: "ADC", name: "Alcohol & Drug Counselor" },
  { code: "AADC", name: "Advanced Alcohol & Drug Counselor" },
  { code: "CS", name: "Clinical Supervisor" },
  { code: "CCJP", name: "Criminal Justice Addictions Professional" },
  { code: "PR-A", name: "Peer Recovery — Associate" },
  { code: "PR-S", name: "Peer Recovery — Supervisor" },
  { code: "PR", name: "Peer Recovery" },
  { code: "PS", name: "Prevention Specialist" },
] as const;

const internationalCertificates = [
  "ICADC — Internationally Certified Alcohol and Drug Counselor",
  "ICAADC — Internationally Certified Advanced Alcohol and Drug Counselor",
  "ICCS — Internationally Certified Clinical Supervisor",
  "ICPS — Internationally Certified Prevention Specialist",
  "ICCJP — Internationally Certified Criminal Justice Professional",
  "ICPR — Internationally Certified Peer Recovery",
  "ICPR-A — Internationally Certified Peer Recovery — Associate",
] as const;

const standards = [
  {
    icon: ShieldCheck,
    title: "Protect the public",
    text: "Competency-based credentialing supports ethical, appropriate, and accountable professional services.",
  },
  {
    icon: Award,
    title: "Set minimum standards",
    text: "IC&RC develops credentialing standards while member boards administer requirements within their jurisdictions.",
  },
  {
    icon: Waypoints,
    title: "Support mobility",
    text: "Reciprocity helps eligible professionals transfer recognized credentials between participating member boards.",
  },
  {
    icon: Scale,
    title: "Maintain integrity",
    text: "Evidence-based examinations and enforceable ethics standards strengthen confidence in the workforce.",
  },
] as const;

export default function IcRcPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-info/[0.07]" aria-hidden />
        <div className="absolute -left-48 -top-48 -z-10 h-[34rem] w-[34rem] rounded-full bg-brand/[0.07] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <Globe2 className="h-4 w-4" aria-hidden />
              Internationally recognized standards
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">ABCAC + IC&amp;RC</p>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Global Standards. Local Support.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              ABCAC is Arizona&apos;s IC&amp;RC member board, connecting credentialed professionals to respected examinations, reciprocal standards, and international recognition.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#how-it-works" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">
                See How It Works <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href={officialSite} variant="outline" size="lg" className="w-full justify-center sm:w-auto">
                Visit IC&amp;RC <ExternalLink className="h-4 w-4" aria-hidden />
              </CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["Member-board support", "Evidence-based exams", "Credential reciprocity"].map((item) => (
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
                src="/brand/icrc-global-hero.png"
                alt="A diverse group of credentialing professionals collaborating with a world map in the background"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-bg">
        <div className="mx-auto grid w-full max-w-[80rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-10 lg:py-24">
          <div className="rounded-3xl border border-line bg-white p-8 shadow-[0_24px_60px_-45px_rgba(13,34,63,0.45)] sm:p-10">
            <Image src="/brand/icrc-logo.png" alt="International Certification and Reciprocity Consortium" width={480} height={165} className="h-auto w-full" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Our International Partnership</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">One credentialing network, supported here in Arizona</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              IC&amp;RC is a nonprofit credentialing organization that develops internationally recognized standards and examinations for prevention, substance use disorder, and recovery professionals.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              ABCAC serves as the local member board. We guide Arizona applicants through eligibility, certification, testing, renewal, and reciprocity while applying the standards relevant to each credential.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-3xl font-semibold text-brand">50,000+</p>
                <p className="mt-1 text-sm text-muted">professionals represented worldwide</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-3xl font-semibold text-brand">11</p>
                <p className="mt-1 text-sm text-muted">international member-board regions</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Mission &amp; Vision</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Credentialing that protects the public and advances the profession</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-line bg-bg p-7 shadow-[0_20px_55px_-45px_rgba(13,34,63,0.5)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
              <h3 className="mt-6 text-2xl">Mission</h3>
              <p className="mt-3 leading-relaxed text-muted">Promote public protection by offering internationally recognized credentials and examinations for prevention, substance use disorder, and recovery professionals.</p>
            </article>
            <article className="rounded-3xl border border-line bg-info p-7 text-white shadow-[0_20px_55px_-45px_rgba(13,34,63,0.5)] sm:p-9">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white"><Globe2 className="h-6 w-6" aria-hidden /></span>
              <h3 className="mt-6 text-2xl text-white">Vision</h3>
              <p className="mt-3 leading-relaxed text-white/70">Be the globally recognized resource for prevention, substance use treatment, and recovery credentialing.</p>
            </article>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {standards.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-line bg-bg p-5">
                  <Icon className="h-6 w-6 text-brand" aria-hidden />
                  <h3 className="mt-4 text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Credential Framework</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">Standards for every stage of the workforce</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">IC&amp;RC provides the framework member boards use to credential professionals across counseling, supervision, criminal justice, prevention, and peer recovery.</p>
              <CtaButton href="/initial-certification" variant="outline" size="lg" className="mt-7 w-full sm:w-auto">Explore ABCAC Credentials</CtaButton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {credentials.map((credential) => (
                <article key={credential.code} className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <span className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-sm font-bold text-brand">{credential.code}</span>
                  <div>
                    <h3 className="text-base">{credential.name}</h3>
                    <p className="mt-1 text-xs text-muted">IC&amp;RC credential framework</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-2 lg:px-12 lg:py-24">
          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><BookOpenCheck className="h-6 w-6" aria-hidden /></span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Exam Preparation</p>
            <h2 className="mt-3 text-3xl text-white">Prepare with current IC&amp;RC resources</h2>
            <p className="mt-4 leading-relaxed text-white/70">Official candidate guides explain exam policies, content domains, sample questions, and blueprints. IC&amp;RC also offers practice exams and links to recommended study materials.</p>
            <ul className="mt-6 space-y-3 text-sm text-white/80">
              {["Free candidate guides and reference lists", "Credential-specific practice exams", "General testing policies and procedures"].map((item) => (
                <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {item}</li>
              ))}
            </ul>
            <CtaButton href={studyMaterials} size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">Official Study Materials <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><ClipboardCheck className="h-6 w-6" aria-hidden /></span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-brand">Testing Through ABCAC</p>
            <h2 className="mt-3 text-3xl">Register locally with the right exam path</h2>
            <p className="mt-4 leading-relaxed text-muted">ABCAC supports approved Arizona candidates with IC&amp;RC examination registration for certification and applicable licensure pathways.</p>
            <div className="mt-6 space-y-4">
              {[
                { icon: BadgeCheck, title: "Confirm eligibility", text: "Make sure you are selecting the examination that matches your certification or licensure goal." },
                { icon: MapPinned, title: "Choose delivery", text: "Review in-person and remote-proctored options available through ABCAC." },
                { icon: FileCheck2, title: "Prepare for test day", text: "Follow your registration notice and the current candidate-guide requirements." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                    <div><h3 className="text-base">{item.title}</h3><p className="mt-1 text-sm text-muted">{item.text}</p></div>
                  </div>
                );
              })}
            </div>
            <CtaButton href="/testing" variant="outline" size="lg" className="mt-7 w-full sm:w-auto">View Testing Options <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">International Recognition</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Request an IC&amp;RC International Certificate</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">An International Certificate is tied directly to a valid credential through an IC&amp;RC member board. It is an endorsement of reciprocal status, not a stand-alone certification.</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-line bg-surface p-7 sm:p-9">
              <h3 className="text-2xl">Available International Certificates</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {internationalCertificates.map((certificate) => (
                  <div key={certificate} className="flex gap-2 rounded-xl bg-bg p-4 text-sm text-muted">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {certificate}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-info p-7 text-white sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Globe2 className="h-6 w-6" aria-hidden /></span>
                <div className="rounded-xl bg-white px-3 py-2"><Image src="/brand/icrc-logo.png" alt="IC&RC" width={120} height={41} className="h-7 w-auto" /></div>
              </div>
              <h3 className="mt-6 text-2xl text-white">Current order options</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-5"><p className="text-3xl font-semibold">$35</p><p className="mt-1 text-sm text-white/70">Digital certificate</p></div>
                <div className="rounded-2xl bg-white/10 p-5"><p className="text-3xl font-semibold">$45</p><p className="mt-1 text-sm text-white/70">Digital + mailed copy</p></div>
              </div>
              <ol className="mt-6 space-y-3 text-sm text-white/75">
                <li className="flex gap-3"><span className="font-semibold text-accent">01</span> Confirm that your ABCAC credential is current and reciprocal-level.</li>
                <li className="flex gap-3"><span className="font-semibold text-accent">02</span> Have a copy of your current member-board certificate ready to upload.</li>
                <li className="flex gap-3"><span className="font-semibold text-accent">03</span> Submit the official IC&amp;RC order form and allow 3–4 weeks for processing.</li>
              </ol>
              <CtaButton href={certificateForms} size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90">Open Official Certificate Form <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
              <p className="mt-4 text-xs leading-relaxed text-white/55">Fees and processing times are controlled by IC&amp;RC and may change. Confirm current details on the official form before submitting.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[80rem] gap-5 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 lg:px-10 lg:py-24">
          <article className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Waypoints className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl">Moving to another jurisdiction?</h2>
            <p className="mt-4 leading-relaxed text-muted">Reciprocity may allow an eligible IC&amp;RC-recognized credential to transfer between participating member boards without starting the credentialing process over.</p>
            <CtaButton href="/reciprocity" variant="outline" size="lg" className="mt-7 w-full sm:w-auto">Explore Reciprocity</CtaButton>
          </article>
          <article className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10 text-info"><Users className="h-6 w-6" aria-hidden /></span>
            <h2 className="mt-6 text-3xl">Unsure where to begin?</h2>
            <p className="mt-4 leading-relaxed text-muted">ABCAC can help you identify the correct Arizona credential, examination pathway, or reciprocity process before you submit an application or payment.</p>
            <CtaButton href="/contact" variant="outline" size="lg" className="mt-7 w-full sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Contact ABCAC</CtaButton>
          </article>
        </div>
      </section>

      <section className="relative overflow-hidden bg-info text-white">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-10 lg:py-16">
          <div>
            <h2 className="text-3xl text-white">Ready to take the next credentialing step?</h2>
            <p className="mt-2 text-white/70">Choose your ABCAC certification path or talk with our team before applying.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaButton href="/initial-certification" size="lg" className="w-full sm:w-auto">View Certification</CtaButton>
            <CtaButton href={siteConfig.contact.emailHref} variant="outline" size="lg" className="w-full border-white text-white hover:bg-white hover:text-info sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Email ABCAC</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
