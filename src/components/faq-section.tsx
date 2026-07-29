import type { ReactNode } from "react";
import { FaqAccordion } from "@/components/faq-accordion";
import type { Faq } from "@/lib/faqs";

interface FaqSectionProps {
  eyebrow?: string;
  title?: string;
  intro?: string;
  items: readonly Faq[];
  actions?: ReactNode;
}

export function FaqSection({
  eyebrow = "Questions",
  title = "Frequently Asked Questions",
  intro,
  items,
  actions,
}: FaqSectionProps) {
  return (
    <section className="relative isolate overflow-hidden bg-info text-white">
      <div className="site-noise absolute inset-0 -z-20" aria-hidden />
      <div className="absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -right-32 -z-10 h-96 w-96 rounded-full bg-white/[0.05] blur-3xl" aria-hidden />
      <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-12 lg:py-28">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-white/35" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">{eyebrow}</p>
          </div>
          <h2 className="mt-5 max-w-lg text-3xl text-white sm:text-4xl">{title}</h2>
          {intro && <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65 sm:text-lg">{intro}</p>}
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/45">
            Still need help? The ABCAC team can guide you to the right certification, testing, or renewal pathway.
          </p>
          {actions && <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">{actions}</div>}
        </div>

        <div>
          <FaqAccordion items={items} />
        </div>
      </div>
    </section>
  );
}
