"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Faq } from "@/lib/faqs";
import { cn } from "@/lib/utils";

/** Client-side FAQ accordion: white cards, maroon questions, gray answers. */
export function FaqAccordion({ items }: { items: readonly Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={f.q}
            className={cn(
              "group overflow-hidden rounded-2xl border bg-surface/95 shadow-[0_16px_45px_-32px_rgba(0,0,0,0.55)] backdrop-blur transition-all",
              isOpen ? "border-brand/35 shadow-[0_24px_55px_-32px_rgba(123,31,31,0.55)]" : "border-white/10 hover:border-white/25",
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full min-h-[68px] items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="hidden text-xs font-bold tracking-[0.12em] text-brand/40 sm:inline">0{i + 1}</span>
                <span className="break-words font-semibold text-ink transition-colors group-hover:text-brand">{f.q}</span>
              </span>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors", isOpen ? "bg-brand text-white" : "bg-brand/[0.07] text-brand")}>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-300", isOpen && "rotate-180")}
                  aria-hidden
                />
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-line px-5 pb-6 pt-4 sm:pl-[4.75rem] sm:pr-6">
                <p className="text-sm leading-relaxed text-muted sm:text-base">{f.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
