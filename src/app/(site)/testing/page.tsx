import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Headphones,
  Laptop,
  MapPin,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from "lucide-react";
import { AzbbheLogo } from "@/components/azbbhe-logo";
import { CtaButton } from "@/components/cta-button";
import { FaqSection } from "@/components/faq-section";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "IC&RC Exam Testing",
  description:
    "Register for an IC&RC examination through ABCAC for certification or Arizona addiction-counseling licensure, with in-person and remote-proctored options.",
};

const officialExamProcess = "https://internationalcredentialing.org/eligibility-registration-administrations/";
const officialCandidateGuides = "https://internationalcredentialing.org/prep-and-study-materials/";
const officialRetakePolicy = "https://internationalcredentialing.org/retakes-disclosure-grievance-and-appeals/";
const azbbheTesting = "https://bbhe.az.gov/addiction-counseling";
const prometricRemote = "https://www.prometric.com/remote-exam-experience/";
const prometricSupport = "https://www.prometric.com/get-testing-support";

const licenseMap = [
  {
    license: "LACT",
    former: "formerly LSAT",
    name: "Licensed Addiction Counselor Technician",
    exam: "ADC",
    certification: "CAC or CADAC pathway",
  },
  {
    license: "LAAC",
    former: "formerly LASAC",
    name: "Licensed Associate Addiction Counselor",
    exam: "AADC",
    certification: "AADC pathway",
  },
  {
    license: "LIAC",
    former: "formerly LISAC",
    name: "Licensed Independent Addiction Counselor",
    exam: "AADC",
    certification: "AADC pathway",
  },
] as const;

const testingSteps = [
  {
    icon: UserCheck,
    title: "Confirm authorization",
    text: "AZBBHE licensure applicants must wait until the Board confirms they are authorized to test. Certification candidates confirm eligibility with ABCAC.",
  },
  {
    icon: ClipboardCheck,
    title: "Choose the right exam",
    text: "Match your license or credential goal to the correct IC&RC designation before paying for registration.",
  },
  {
    icon: Laptop,
    title: "Select your exam mode",
    text: "Choose an in-person testing center or the remote-proctored option if your equipment and private testing space qualify.",
  },
  {
    icon: FileCheck2,
    title: "Register and pay",
    text: "Complete the ABCAC checkout for your selected exam mode. Payment starts the official pre-registration process.",
  },
  {
    icon: CalendarCheck2,
    title: "Schedule with Prometric",
    text: "After ABCAC pre-registers you, follow the scheduling email to select your available date, time, and location.",
  },
] as const;

const examFormats = [
  { exam: "ADC", credentials: "CAC / CADAC", questions: "150", time: "3 hours" },
  { exam: "AADC", credentials: "AADC / LAAC / LIAC", questions: "150", time: "3 hours" },
  { exam: "CS", credentials: "CCS", questions: "150", time: "3 hours" },
  { exam: "CCJP", credentials: "CCJP", questions: "60", time: "1.5 hours" },
  { exam: "PR", credentials: "CPRS", questions: "75", time: "2 hours" },
  { exam: "PS", credentials: "CPS", questions: "150", time: "3 hours" },
] as const;

const remoteRequirements = [
  "A supported laptop or desktop with webcam, microphone, and reliable internet",
  "A private, indoor, well-lit room with no other people present",
  "A clean workstation without notes, devices, or unauthorized materials",
  "A successful system-readiness check before exam day",
] as const;

const testingFaqs = [
  {
    q: "How do I register for an IC&RC exam through ABCAC?",
    a: "First confirm you are eligible to test. AZBBHE licensure applicants must wait for authorization from the Board. Then choose the correct exam and testing mode, complete payment through ABCAC, and watch for the scheduling email sent after pre-registration.",
  },
  {
    q: "Where can I take the exam?",
    a: "IC&RC exams are delivered through Prometric. ABCAC candidates may choose the available in-person testing option or remote proctoring when permitted. Availability is shown when the candidate receives scheduling instructions.",
  },
  {
    q: "What should I bring on exam day?",
    a: "For an in-person exam, bring a valid government-issued photo ID and your Candidate Admission Letter. Your name must match the registration. Remote candidates must follow the identity, room-scan, workspace, and equipment instructions in their confirmation materials.",
  },
  {
    q: "What happens if I do not pass the exam?",
    a: "IC&RC requires a 90-day waiting period after the original test date before a retake. Contact ABCAC to confirm eligibility and arrange a new registration. Member boards may apply additional requirements after repeated attempts.",
  },
  {
    q: "Can I request special testing accommodations?",
    a: "Yes. Submit a written request and supporting documentation to ABCAC before scheduling the examination. Accommodations cannot be added after you schedule without further coordination and approval.",
  },
  {
    q: "How long is the IC&RC exam?",
    a: "Exam length varies by designation. ADC, AADC, CS, and PS are 150 questions with a 3-hour administration. CCJP is 60 questions in 1.5 hours, and PR is 75 questions in 2 hours. Review the current IC&RC Candidate Guide for your designation before testing.",
  },
] as const;

export default function TestingPage() {
  const inPerson = getProductBySlug("testing-for-licensure-with-azbbhe");
  const remote = getProductBySlug("testing-for-licensure-with-azbbhe-remote-proctored-exam");

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.06]" aria-hidden />
        <div className="absolute -left-44 -top-48 -z-10 h-[34rem] w-[34rem] rounded-full bg-info/[0.07] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <MonitorCheck className="h-4 w-4" aria-hidden />
              IC&amp;RC exam registration
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Testing &amp; Exam Support</p>
            <h1 className="max-w-[14ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Your Exam Path, Clearly Mapped.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Take your approved examination through the Arizona Board for the Certification of Addiction Counselors — whether pursuing certification with ABCAC and IC&amp;RC or licensure through the Arizona Board of Behavioral Health Examiners, based on your chosen professional path.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#exam-options" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">
                Choose Your Exam Mode <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href="#license-map" variant="outline" size="lg" className="w-full justify-center sm:w-auto">Match Your License</CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["AZBBHE licensure support", "In-person or remote", "Secure Stripe checkout"].map((item) => (
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
                src="/brand/testing-hero.png"
                alt="A behavioral health professional preparing for a computer-based credentialing exam"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">How Registration Works</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">From eligibility to exam day in five steps</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">Candidates register through an IC&amp;RC member board. ABCAC confirms the pathway, processes payment, and pre-registers approved candidates for scheduling.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {testingSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-2xl border border-line bg-surface p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                    <span className="font-display text-3xl font-semibold text-brand/15">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 text-center">
            <CtaButton href={officialExamProcess} variant="outline" size="lg" className="w-full sm:w-auto">
              Review Official IC&amp;RC Process <ExternalLink className="h-4 w-4" aria-hidden />
            </CtaButton>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[82rem] items-center gap-10 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-10 lg:py-24">
          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white shadow-[0_28px_65px_-45px_rgba(13,34,63,0.7)] sm:p-9">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
              <AzbbheLogo />
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">AZBBHE Applicants</p>
            <h2 className="mt-3 text-3xl text-white">Are you AZBBHE-approved?</h2>
            <p className="mt-4 leading-relaxed text-white/75">
              If you&apos;ve been approved by the Arizona Board of Behavioral Health Examiners (AZBBHE), you are eligible to
              test through ABCAC — and you are <strong className="text-white">exempt from the 2,000 supervised hours</strong> typically
              required for IC&amp;RC certification.
            </p>
            <p className="mt-3 leading-relaxed text-white/75">
              AZBBHE notifies addiction-counseling applicants when they are authorized to test. Do not purchase a
              licensure exam until that authorization is confirmed.
            </p>
            <CtaButton href={azbbheTesting} size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">
              Visit AZBBHE Testing Information <ExternalLink className="h-4 w-4" aria-hidden />
            </CtaButton>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Two Organizations, Two Roles</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Licensure authorization and certification eligibility are separate</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              AZBBHE determines eligibility for Arizona licensure. ABCAC administers IC&amp;RC exam registration and separately evaluates applicants seeking an ABCAC professional certification.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-bg p-5">
                <BadgeCheck className="h-6 w-6 text-brand" aria-hidden />
                <h3 className="mt-4 text-lg">Testing for licensure</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Wait for AZBBHE authorization, then register for the exam identified by the Board.</p>
              </div>
              <div className="rounded-2xl border border-line bg-bg p-5">
                <GraduationCap className="h-6 w-6 text-brand" aria-hidden />
                <h3 className="mt-4 text-lg">Testing for certification</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Confirm ABCAC credential requirements before selecting the corresponding IC&amp;RC exam.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="license-map" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Arizona License Mapping</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Match your current license title to the exam</h2>
            <p className="mt-4 text-lg text-muted">Arizona renamed its addiction-counseling licenses. Use your authorization notice as the final source of truth if it identifies a specific exam.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {licenseMap.map((item) => (
              <article key={item.license} className="rounded-3xl border border-line bg-surface p-6 shadow-[0_20px_55px_-45px_rgba(13,34,63,0.55)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-14 min-w-20 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">{item.license}</span>
                  <span className="rounded-full bg-brand/[0.06] px-3 py-1.5 text-xs font-semibold text-brand">{item.former}</span>
                </div>
                <h3 className="mt-6 text-xl">{item.name}</h3>
                <div className="mt-6 rounded-2xl bg-bg p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">IC&amp;RC exam</p>
                  <p className="mt-1 text-2xl font-semibold text-brand">{item.exam}</p>
                  <p className="mt-2 text-sm text-muted">ABCAC: {item.certification}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="exam-options" className="scroll-mt-24 bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Select Your Exam Mode</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Choose in-person or remote proctoring</h2>
            <p className="mt-4 text-lg text-muted">Both options include IC&amp;RC exam registration through ABCAC. Choose the mode that fits your environment and technology.</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {inPerson && (
              <article className="overflow-hidden rounded-3xl border border-line bg-bg shadow-[0_24px_65px_-48px_rgba(13,34,63,0.55)]">
                <div className="h-2 bg-info" />
                <div className="p-7 sm:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10 text-info"><MapPin className="h-6 w-6" aria-hidden /></span>
                    <PriceTag product={inPerson} className="text-3xl text-info" />
                  </div>
                  <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-brand">In-Person Testing</p>
                  <h3 className="mt-2 text-3xl">Test at an available Prometric location</h3>
                  <p className="mt-4 leading-relaxed text-muted">Choose an available testing center after ABCAC completes pre-registration. Bring your Candidate Admission Letter and matching government-issued photo ID.</p>
                  <ul className="mt-6 space-y-3 text-sm text-muted">
                    {["Secure computer-based testing center", "On-site testing staff", "Best for candidates who prefer a traditional test environment"].map((item) => (
                      <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {item}</li>
                    ))}
                  </ul>
                  <CtaButton href="/account/testing?mode=in_person" size="lg" className="mt-7 w-full">Start In-Person Pre-Registration</CtaButton>
                </div>
              </article>
            )}

            {remote && (
              <article className="overflow-hidden rounded-3xl border border-line bg-bg shadow-[0_24px_65px_-48px_rgba(13,34,63,0.55)]">
                <div className="h-2 bg-brand" />
                <div className="p-7 sm:p-9">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Laptop className="h-6 w-6" aria-hidden /></span>
                    <PriceTag product={remote} className="text-3xl text-brand" />
                  </div>
                  <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-brand">Remote-Proctored Testing</p>
                  <h3 className="mt-2 text-3xl">Test from a qualified private space</h3>
                  <p className="mt-4 leading-relaxed text-muted">Use Prometric ProProctor from an approved computer and private room. Complete the system-readiness check and carefully review every remote-exam rule before scheduling.</p>
                  <ul className="mt-6 space-y-3 text-sm text-muted">
                    {["Live online proctoring", "Room and workstation security scan", "System and environment requirements apply"].map((item) => (
                      <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {item}</li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-xl bg-brand/[0.06] px-4 py-3 text-sm font-semibold text-brand">Remote proctoring fee: $50, in addition to the exam cost. Testing partner: Prometric — a global leader in online assessment.</p>
                  <CtaButton href="/account/testing?mode=remote" size="lg" className="mt-7 w-full">Start Remote Pre-Registration</CtaButton>
                </div>
              </article>
            )}
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted">Create or sign in to your ABCAC account to save the request. After payment, ABCAC completes SMT pre-registration and notifies you in the portal and by email. Want an ABCAC professional credential with your exam? Add it for only $150.00 more during pre-registration.</p>
        </div>
      </section>

      <section className="bg-info text-white">
        <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Remote Exam Readiness</p>
            <h2 className="mt-3 text-3xl text-white sm:text-4xl">Prepare your room and technology before exam day</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">Remote testing is convenient, but the security rules are strict. A system or room issue can prevent the exam from starting.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {remoteRequirements.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-white/[0.07] p-4 text-sm text-white/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-9">
            <Headphones className="h-8 w-8 text-white" aria-hidden />
            <h3 className="mt-5 text-2xl text-white">Remote-exam protocols</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-white/75">
              <li>Show your government-issued ID, workstation, and surrounding room during check-in.</li>
              <li>Empty pockets and follow requested sleeve, eyeglass, jewelry, and hair inspections.</li>
              <li>No other person may enter the room during the examination.</li>
              <li>Remain in camera view unless an approved break or accommodation says otherwise.</li>
              <li>Do not use notes, phones, extra monitors, or unauthorized materials.</li>
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href={prometricRemote} size="lg" className="w-full bg-white text-info hover:bg-white/90 sm:w-auto">Remote Exam Guide <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
              <CtaButton href={prometricSupport} variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto">Prometric Support</CtaButton>
            </div>
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 pb-14 sm:px-8 sm:pb-16 lg:grid-cols-2 lg:px-12 lg:pb-24">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-8">
            <h3 className="text-2xl text-white">Technical + accommodation support</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-white/80">
              <li><span className="font-semibold text-white">Prometric accommodations:</span> <a href="tel:1-800-789-9947" className="underline decoration-white/40 underline-offset-2 hover:text-white">1-800-789-9947</a> (Option 3)</li>
              <li><span className="font-semibold text-white">Schedule / reschedule (U.S. &amp; Canada):</span> <a href="tel:1-800-813-6779" className="underline decoration-white/40 underline-offset-2 hover:text-white">1-800-813-6779</a></li>
              <li><span className="font-semibold text-white">International:</span> <a href="tel:+14434556299" className="underline decoration-white/40 underline-offset-2 hover:text-white">+1-443-455-6299</a></li>
              <li><span className="font-semibold text-white">Email:</span> <a href="mailto:pro-proctor@prometric.com" className="underline decoration-white/40 underline-offset-2 hover:text-white">pro-proctor@prometric.com</a></li>
              <li><span className="font-semibold text-white">Technical support:</span> <a href={prometricSupport} className="underline decoration-white/40 underline-offset-2 hover:text-white">Prometric support page</a></li>
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 sm:p-8">
            <h3 className="text-2xl text-white">Free re-sits (if eligible)</h3>
            <p className="mt-4 text-sm leading-relaxed text-white/80">Free retakes may be approved in rare cases, such as:</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/80">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> Verified technical issues that were not caused by the candidate</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> Serious medical or personal emergencies</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-white/80">Documentation is required. Contact ABCAC for review.</p>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Current Exam Formats</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Exam length depends on your designation</h2>
            <p className="mt-4 text-lg text-muted">All exams use multiple-choice questions and include unscored pretest items. Review the current candidate guide for your exact content blueprint.</p>
          </div>
          <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_60px_-50px_rgba(13,34,63,0.6)]">
            <div className="hidden grid-cols-[0.7fr_1.3fr_0.7fr_0.7fr] gap-4 border-b border-line bg-info px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white md:grid">
              <span>IC&amp;RC Exam</span><span>ABCAC / Arizona Path</span><span>Questions</span><span>Time</span>
            </div>
            <div className="divide-y divide-line">
              {examFormats.map((item) => (
                <div key={item.exam} className="grid gap-3 px-5 py-5 md:grid-cols-[0.7fr_1.3fr_0.7fr_0.7fr] md:items-center md:gap-4 md:px-6">
                  <div><span className="rounded-lg bg-brand/10 px-3 py-2 text-sm font-bold text-brand">{item.exam}</span></div>
                  <div><span className="text-xs font-semibold uppercase tracking-wide text-muted md:hidden">Path </span><span className="font-medium text-ink">{item.credentials}</span></div>
                  <div><span className="text-xs font-semibold uppercase tracking-wide text-muted md:hidden">Questions </span><span className="text-muted">{item.questions}</span></div>
                  <div className="flex items-center gap-2 text-muted"><Clock3 className="h-4 w-4 text-brand" aria-hidden /> {item.time}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 text-center">
            <CtaButton href={officialCandidateGuides} variant="outline" size="lg" className="w-full sm:w-auto">Open Candidate Guides <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:py-24">
          <article className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <Upload className="h-8 w-8 text-brand" aria-hidden />
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-brand">Special Accommodations</p>
            <h2 className="mt-3 text-3xl">Request approval before scheduling</h2>
            <p className="mt-4 leading-relaxed text-muted">If you require special testing accommodations, submit your completed accommodations request to ABCAC at the time you pay for your exam — accommodations cannot be processed after registration is complete. ABCAC reviews the request and coordinates approved modifications with the testing provider.</p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Include the specific accommodation requested.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Provide documentation that supports the request under current guidelines.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Wait for approval before scheduling your examination.</li>
            </ul>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="/account/forms?workflow=testing%3Aaccommodations" size="lg" className="w-full sm:w-auto">Complete Digital Form</CtaButton>
              <CtaButton href="/forms/library/testing-special-accommodations.pdf" variant="outline" size="lg" className="w-full sm:w-auto">Download Paper Form</CtaButton>
            </div>
          </article>

          <article className="rounded-3xl border border-line bg-bg p-7 sm:p-9">
            <BookOpenCheck className="h-8 w-8 text-brand" aria-hidden />
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-brand">Study Materials</p>
            <h2 className="mt-3 text-3xl">Prepare with the official exam blueprint</h2>
            <p className="mt-4 leading-relaxed text-muted">IC&amp;RC publishes free candidate guides and reference lists with content domains, sample questions, and designation-specific exam blueprints. Optional practice exams are purchased directly from IC&amp;RC.</p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Download the General Candidate Guide.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Use the guide matching your scheduled exam version.</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> Review content domains before purchasing a practice exam.</li>
            </ul>
            <CtaButton href={officialCandidateGuides} size="lg" className="mt-7 w-full sm:w-auto">View Official Study Materials <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
          </article>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto w-full max-w-[86rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Testing for ABCAC Certifications</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Test for all seven credentials directly through ABCAC</h2>
            <p className="mt-4 text-lg text-muted">ABCAC is an IC&amp;RC member board offering internationally recognized credentials in addiction counseling, peer recovery, prevention, clinical supervision, and related fields.</p>
          </div>
          <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2.5">
            {[
              "Certified Addiction Counselor (CAC)",
              "Certified Alcohol & Drug Abuse Counselor (CADAC)",
              "Advanced Alcohol and Drug Counselor (AADC)",
              "Certified Clinical Supervisor (CCS)",
              "Certified Prevention Specialist (CPS)",
              "Certified Criminal Justice Professional (CCJP)",
              "Certified Peer Recovery Specialist (CPRS)",
            ].map((credential) => (
              <span key={credential} className="rounded-full border border-brand/15 bg-surface px-4 py-2 text-sm font-semibold text-ink">{credential}</span>
            ))}
          </div>
          <div className="mx-auto mt-14 max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">The Benefits of Becoming Certified</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">A credential built on competency and ethics</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Sparkles, title: "Professional recognition", text: "ABCAC certification is a symbol of expertise and professional integrity, enhancing credibility with employers, peers, and clients." },
              { icon: GraduationCap, title: "Career advancement", text: "Many organizations prioritize hiring and promoting certified professionals, making certification a valuable tool for career growth." },
              { icon: BookOpenCheck, title: "Enhanced competence", text: "Certification ensures a robust foundation in addiction counseling through rigorous educational, experiential, and examination requirements." },
              { icon: ShieldCheck, title: "Ethical standards", text: "Certified professionals commit to ABCAC's Code of Ethics, fostering trust and professionalism with clients and colleagues." },
              { icon: Headphones, title: "Networking and support", text: "Access a community of certified professionals offering mentorship, collaboration, and continued professional development." },
              { icon: BadgeCheck, title: "Reciprocity opportunities", text: "Transfer credentials to other IC&RC member boards in the U.S. Reciprocity requirements vary by state — consult ABCAC and the receiving board." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-line bg-surface p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-5 text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </article>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-muted">
            Pursuing ABCAC certification reflects your dedication to professional growth, ethical practice, and public
            trust — with pathways for mobility and advancement in a dynamic, evolving field. For additional information
            or assistance, contact ABCAC directly.
          </p>
        </div>
      </section>

      <FaqSection
        eyebrow="Testing FAQ"
        title="Answers before you register"
        intro="Review the most common exam questions, then contact ABCAC if your authorization or credential path is still unclear."
        items={testingFaqs}
        actions={
          <>
            <CtaButton href={officialRetakePolicy} variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto">Official Retake Policy <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
            <CtaButton href={siteConfig.contact.emailHref} size="lg" className="w-full bg-white text-info hover:bg-white/90 sm:w-auto">Email ABCAC</CtaButton>
          </>
        }
      />

      <section className="bg-surface">
        <div className="mx-auto flex w-full max-w-[82rem] flex-col items-center gap-6 px-5 py-14 text-center sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <MonitorCheck className="h-10 w-10 text-brand" aria-hidden />
          <div>
            <h2 className="text-3xl sm:text-4xl">Ready to register for your exam?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">Confirm authorization, choose your testing mode, and complete secure payment to begin pre-registration.</p>
          </div>
          <CtaButton href="#exam-options" size="lg" className="w-full sm:w-auto">Choose Your Testing Option <ArrowRight className="h-4 w-4" aria-hidden /></CtaButton>
        </div>
      </section>
    </>
  );
}
