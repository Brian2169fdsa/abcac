"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Faq } from "@/lib/faqs";
import { cn } from "@/lib/utils";

/** Client-side FAQ accordion: white cards, maroon questions, gray answers. */
export function FaqAccordion({ items }: { items: readonly Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-xl bg-surface shadow-sm">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-semibold text-brand">{f.q}</span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-brand transition-transform", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
