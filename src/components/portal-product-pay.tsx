"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CheckoutPrefill } from "@/components/checkout-form";
import { CheckoutForm } from "@/components/checkout-form";
import { PriceTag } from "@/components/price-tag";
import { buttonVariants } from "@/components/ui/button";
import type { Product } from "@/lib/catalog";

/** One product row on the portal Payments page: price + expandable checkout
 *  with the member's payer details pre-filled. */
export function PortalProductPay({
  product,
  prefill,
  defaultOpen = false,
  applicationId,
}: {
  product: Product;
  prefill: CheckoutPrefill;
  defaultOpen?: boolean;
  /** Links the fee to a submitted application so admin review shows it paid. */
  applicationId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [defaultOpen]);

  return (
    <div ref={ref} className="rounded-2xl border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{product.name}</h3>
          <p className="mt-1 text-sm text-muted">{product.short}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PriceTag product={product} />
          <span className={buttonVariants({ size: "sm", variant: open ? "outline" : "primary" })}>
            {open ? "Close" : "Pay"} <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-line p-5">
          <CheckoutForm
            slug={product.slug}
            category={product.category}
            examMode={product.examMode}
            unitPrice={product.price}
            prefill={prefill}
            applicationId={applicationId}
          />
        </div>
      )}
    </div>
  );
}
