import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PriceTag } from "@/components/price-tag";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/store/${product.slug}`}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{product.category}</p>
      <h3 className="mt-2 break-words text-lg">{product.name}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{product.short}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <PriceTag product={product} className="text-xl" />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          View <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
