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
      <div className="absolute -left-32 -top-32 -z-10 h-80 w-80 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -right-32 -z-10 h-96 w-96 rounded-full bg-white/[0.05] blur-3xl" aria-hidden />
      <div className="mx-auto w-full max-w-[90rem] px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">{eyebrow}</p>
          <h2 className="mt-3 text-3xl text-white sm:text-4xl">{title}</h2>
          {intro && <p className="mt-4 text-lg text-white/65">{intro}</p>}
        </div>
        <div className="mt-10">
          <FaqAccordion items={items} />
        </div>
        {actions && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{actions}</div>}
      </div>
    </section>
  );
}
