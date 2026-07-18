import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Globe2,
  Mail,
  MapPinned,
  SearchCheck,
  ShieldCheck,
  Upload,
  Waypoints,
} from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { FaqAccordion } from "@/components/faq-accordion";
import { PriceTag } from "@/components/price-tag";
import { getProductBySlug } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "IC&RC Reciprocity Transfers",
  description:
    "Transfer an eligible IC&RC-recognized credential into or out of Arizona through ABCAC with clear eligibility, application, payment, and processing guidance.",
};

const officialReciprocity = "https://internationalcredentialing.org/reciprocity-international-certificates/";
const memberBoardDirectory = "https://internationalcredentialing.org/member-boards/";

const transferSteps = [
  {
    icon: SearchCheck,
    title: "Check the destination",
    text: "Contact the member board where you plan to move and confirm that it offers your credential at the reciprocal level.",
  },
  {
    icon: ClipboardCheck,
    title: "Contact your current board",
    text: "Request the official Application for Reciprocity from the IC&RC member board where you are currently credentialed.",
  },
  {
    icon: FileCheck2,
    title: "Complete the application",
    text: "Return the completed application and any required documentation to your current member board for verification.",
  },
  {
    icon: Waypoints,
    title: "Board and IC&RC review",
    text: "Your current board verifies the credential and sends the transfer materials through IC&RC to the receiving board.",
  },
  {
    icon: BadgeCheck,
    title: "Receiving board follow-up",
    text: "The destination board reviews its local requirements and contacts you with approval or any additional steps.",
  },
] as const;

const abcacCredentials = [
  { code: "CADAC", name: "Certified Alcohol & Drug Abuse Counselor" },
  { code: "AADC", name: "Advanced Alcohol & Drug Counselor" },
  { code: "CCS", name: "Certified Clinical Supervisor" },
  { code: "CPS", name: "Certified Prevention Specialist" },
  { code: "CCJP", name: "Certified Criminal Justice Professional" },
  { code: "CPRS", name: "Certified Peer Recovery Specialist" },
] as const;

const reciprocityFaqs = [
  {
    q: "Can every credential transfer through IC&RC reciprocity?",
    a: "No. Your credential must be current, valid, and offered at a reciprocal level by both your current member board and the destination member board. Confirm eligibility with the destination board before starting.",
  },
  {
    q: "Where do I begin the reciprocity process?",
    a: "First contact the board in the jurisdiction where you plan to move so you understand its requirements. Then request the official reciprocity application from the IC&RC member board where you are currently credentialed.",
  },
  {
    q: "How much does reciprocity cost?",
    a: "The IC&RC reciprocity fee is $150 per credential transferred. A destination board may also have additional application requirements or local fees. For an outbound ABCAC transfer, the $150 fee is collected through the member portal after the request is submitted.",
  },
  {
    q: "How long does a reciprocity transfer take?",
    a: "Timelines depend on the current board, IC&RC, and the receiving board. IC&RC advises contacting your current board if you have not received an IC&RC update within four to six weeks. Start well before relocating or before your credential expires.",
  },
  {
    q: "Can I transfer an expired credential?",
    a: "No. Your credential must be current and valid. If it has expired, renew it with your current board before requesting reciprocity.",
  },
  {
    q: "Does reciprocity automatically give me the same credential title?",
    a: "Not always. Each member board controls the credential or license it issues and may require additional standards. Reciprocity transfers recognized standing; the receiving jurisdiction makes the final decision.",
  },
] as const;

export default function ReciprocityPage() {
  const transferProduct = getProductBySlug("icrc-reciprocity-transfer");

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-info/[0.07]" aria-hidden />
        <div className="absolute -left-48 -top-48 -z-10 h-[34rem] w-[34rem] rounded-full bg-brand/[0.07] blur-3xl" aria-hidden />
        <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-14 lg:px-12 lg:py-20 xl:px-16">
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3.5 py-2 text-xs font-semibold text-brand shadow-sm">
              <Waypoints className="h-4 w-4" aria-hidden />
              IC&amp;RC credential mobility
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Reciprocity Transfers</p>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,4vw,4.25rem)] tracking-[-0.035em]">Take Your Credential With You.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Move an eligible IC&amp;RC-recognized credential into or out of Arizona through a coordinated process involving your current board, IC&amp;RC, and the receiving board.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CtaButton href="#directions" size="lg" className="w-full justify-center shadow-lg shadow-brand/20 sm:w-auto">
                Choose Your Direction <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href={memberBoardDirectory} variant="outline" size="lg" className="w-full justify-center sm:w-auto">
                Find a Member Board <ExternalLink className="h-4 w-4" aria-hidden />
              </CtaButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-ink">
              {["Current credential required", "$150 per credential", "Destination rules may apply"].map((item) => (
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
                src="/brand/reciprocity-hero.png"
                alt="Credentialing professionals reviewing a reciprocity transfer with a United States map behind them"
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
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Before You Apply</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Confirm eligibility before starting a transfer</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">Reciprocity is available only between IC&amp;RC member boards that offer the same credential at a reciprocal level.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Current and valid", text: "Your credential cannot be expired or lapsed when you apply for reciprocity." },
              { icon: Globe2, title: "Both boards participate", text: "Your current and destination boards must both offer the credential at a reciprocal level." },
              { icon: Clock3, title: "Begin early", text: "Investigate requirements well before relocating and before your current credential approaches expiration." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-line bg-surface p-6 shadow-[0_18px_45px_-40px_rgba(13,34,63,0.5)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-5 text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Official Transfer Sequence</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Five steps from one member board to another</h2>
            <p className="mt-4 text-lg text-muted">The application begins with your current member board—not with IC&amp;RC directly.</p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {transferSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-2xl border border-line bg-bg p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
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
            <CtaButton href={officialReciprocity} variant="outline" size="lg" className="w-full sm:w-auto">Review Official IC&amp;RC Guidance <ExternalLink className="h-4 w-4" aria-hidden /></CtaButton>
          </div>
        </div>
      </section>

      <section id="directions" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Choose Your Direction</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Moving into Arizona or transferring out?</h2>
            <p className="mt-4 text-lg text-muted">The official sequence is the same, but the board that starts the application and collects the transfer fee depends on where your credential is currently held.</p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_65px_-48px_rgba(13,34,63,0.5)]">
              <div className="h-2 bg-success" />
              <div className="p-7 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success"><ArrowDownToLine className="h-6 w-6" aria-hidden /></span>
                  <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Inbound to ABCAC</span>
                </div>
                <h3 className="mt-6 text-3xl">Transferring into Arizona</h3>
                <p className="mt-4 leading-relaxed text-muted">Start by confirming Arizona requirements with ABCAC. Then request the official reciprocity application from the member board where you currently hold the credential.</p>
                <ol className="mt-6 space-y-3 text-sm text-muted">
                  <li className="flex gap-3"><span className="font-semibold text-brand">01</span> Confirm ABCAC offers your credential at the reciprocal level.</li>
                  <li className="flex gap-3"><span className="font-semibold text-brand">02</span> Ask your current board for the IC&amp;RC reciprocity application.</li>
                  <li className="flex gap-3"><span className="font-semibold text-brand">03</span> Submit an inbound notice in the ABCAC portal so our team can prepare for the transfer.</li>
                </ol>
                <div className="mt-6 rounded-2xl border border-success/20 bg-success/[0.06] p-4 text-sm text-muted">
                  <strong className="text-ink">ABCAC inbound notice:</strong> no fee. Your current board handles the official application and IC&amp;RC transfer fee. Additional Arizona requirements may still apply.
                </div>
                <CtaButton href="/account/requests" size="lg" className="mt-7 w-full">Submit Inbound Notice</CtaButton>
              </div>
            </article>

            <article className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_65px_-48px_rgba(13,34,63,0.5)]">
              <div className="h-2 bg-brand" />
              <div className="p-7 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><ArrowUpFromLine className="h-6 w-6" aria-hidden /></span>
                  <span className="rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">Outbound from ABCAC</span>
                </div>
                <h3 className="mt-6 text-3xl">Transferring out of Arizona</h3>
                <p className="mt-4 leading-relaxed text-muted">Contact the destination board first, then submit your outbound request through the ABCAC member portal. ABCAC verifies your credential and coordinates the official transfer.</p>
                <ol className="mt-6 space-y-3 text-sm text-muted">
                  <li className="flex gap-3"><span className="font-semibold text-brand">01</span> Confirm the destination board accepts your credential and review its local requirements.</li>
                  <li className="flex gap-3"><span className="font-semibold text-brand">02</span> Submit the destination board and contact details through your ABCAC account.</li>
                  <li className="flex gap-3"><span className="font-semibold text-brand">03</span> Complete the secure transfer payment after submitting the request.</li>
                </ol>
                {transferProduct && (
                  <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/[0.05] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div><strong className="text-ink">IC&amp;RC transfer fee</strong><p className="mt-1 text-xs text-muted">Per credential transferred from ABCAC</p></div>
                      <PriceTag product={transferProduct} className="text-2xl font-semibold text-brand" />
                    </div>
                  </div>
                )}
                <CtaButton href="/account/requests" size="lg" className="mt-7 w-full">Start Outbound Transfer</CtaButton>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">ABCAC Reciprocal Credentials</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Credential paths supported through our member board</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">Eligibility still depends on the destination board offering the equivalent credential at a reciprocal level.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {abcacCredentials.map((credential) => (
                <div key={credential.code} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-4">
                  <span className="flex h-10 min-w-14 items-center justify-center rounded-lg bg-brand/10 px-2 text-xs font-bold text-brand">{credential.code}</span>
                  <span className="text-sm font-medium text-ink">{credential.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-info to-[#17365c] p-7 text-white sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Upload className="h-6 w-6" aria-hidden /></span>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Prepare Your Request</p>
            <h2 className="mt-3 text-3xl text-white">Have the right details ready</h2>
            <p className="mt-4 leading-relaxed text-white/70">A complete request helps ABCAC coordinate with the correct board and reduces avoidable follow-up.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Current credential and certification number", "Destination or origin member-board name", "Member-board contact email", "Reason for transfer or relocation", "Current contact information", "Any destination-board instructions"].map((item) => (
                <li key={item} className="flex gap-2 rounded-xl bg-white/[0.07] p-3 text-sm text-white/80"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /> {item}</li>
              ))}
            </ul>
            <CtaButton href="/account/requests" size="lg" className="mt-7 w-full bg-white text-info hover:bg-white/90 sm:w-auto">Open Reciprocity Request</CtaButton>
          </div>
        </div>
      </section>

      <section className="bg-bg">
        <div className="mx-auto grid w-full max-w-[80rem] gap-5 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-3 lg:px-10 lg:py-24">
          {[
            { icon: CreditCard, title: "One fee per credential", text: "The IC&RC reciprocity fee is $150 for each credential transferred. A destination board may charge separate local fees." },
            { icon: MapPinned, title: "Local rules still apply", text: "The receiving board may require additional education, documentation, applications, or jurisdiction-specific standards." },
            { icon: Clock3, title: "Track through your board", text: "If an update is delayed, contact the member board where the application began before contacting IC&RC." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-line bg-surface p-6">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <h3 className="mt-4 text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto w-full max-w-[80rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Reciprocity FAQ</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Answers before you transfer</h2>
            <p className="mt-4 text-lg text-muted">Review eligibility, timing, fees, and what the destination board controls.</p>
          </div>
          <div className="mt-10"><FaqAccordion items={reciprocityFaqs} /></div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-info text-white">
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center lg:px-10 lg:py-16">
          <div>
            <h2 className="text-3xl text-white">Ready to start your transfer?</h2>
            <p className="mt-2 text-white/70">Confirm the destination requirements, gather your board details, and submit the correct reciprocity request.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <CtaButton href="/account/requests" size="lg" className="w-full sm:w-auto">Start Reciprocity Request</CtaButton>
            <CtaButton href={siteConfig.contact.emailHref} variant="outline" size="lg" className="w-full border-white text-white hover:bg-white hover:text-info sm:w-auto"><Mail className="h-4 w-4" aria-hidden /> Email ABCAC</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
