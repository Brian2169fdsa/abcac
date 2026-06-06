import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ArrowLeft } from "lucide-react";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { PriceTag } from "@/components/price-tag";
import { CheckoutForm } from "@/components/checkout-form";

export function generateStaticParams() {
  return getProducts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.short };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-content px-5 py-12 md:px-8 md:py-16">
      <Link href="/store" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to store
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{product.category}</p>
          <h1 className="mt-2">{product.name}</h1>
          <div className="mt-4">
            <PriceTag product={product} className="text-3xl" />
          </div>
          <p className="mt-5 text-lg text-muted">{product.short}</p>

          {product.includes.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl">What&apos;s included</h2>
              <ul className="mt-4 space-y-2">
                {product.includes.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 flex-shrink-0 text-success" aria-hidden />
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutForm slug={product.slug} category={product.category} examMode={product.examMode} />
        </div>
      </div>
    </div>
  );
}
