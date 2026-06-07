import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { getProductBySlug } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Initial or Renewal",
  description: "Select your certification payment type — initial certification or 2-year renewal — to keep your ABCAC credential active and recognized.",
};

const slugs = [
  "initial-certification-full-application-exam-fee",
  "initial-certification-full-application-exam-fee-remote-proctored-exam",
  "certification-certification-only-fee-already-passed-icrc-exam",
  "certification-renewal-2-year-credential-renewal-fee",
];

export default function InitialOrRenewalPage() {
  const products = slugs.map((s) => getProductBySlug(s)).filter(Boolean);
  return (
    <>
      <PageHero
        eyebrow="Pay for Certification"
        title="Initial Certification or Renewal"
        intro="Begin or continue your credentialing journey with ABCAC by selecting the appropriate certification payment below. Whether you're applying for the first time or renewing, this step keeps your certification active and recognized."
      />
      <Section>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p!.slug} product={p!} />
          ))}
        </div>
      </Section>
    </>
  );
}
