import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Store",
  description:
    "Submit payments for ABCAC services: IC&RC testing, initial certification, reciprocity, recertification, CEU endorsement, and remote proctoring fees.",
};

const CATEGORY_ORDER = ["Certification", "Renewal", "Testing", "CEU Endorsement", "Service", "Provider Fee"];

export default function StorePage() {
  const products = getProducts();
  const categories = CATEGORY_ORDER.filter((c) => products.some((p) => p.category === c));

  return (
    <>
      <PageHero
        eyebrow="Payments"
        title="ABCAC Certification Services & Exam Payments"
        intro="Testing, certification, and renewal for addiction counseling in Arizona. Each service supports your path toward licensure and credentialing in Arizona and through the IC&RC global network."
      />
      {categories.map((category) => (
        <Section key={category} title={category} compact>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products
              .filter((p) => p.category === category)
              .map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
          </div>
        </Section>
      ))}
    </>
  );
}
