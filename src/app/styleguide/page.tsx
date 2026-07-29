import { notFound } from "next/navigation";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/cta-button";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { ServiceCard } from "@/components/service-card";
import { ProductCard } from "@/components/product-card";
import { PriceTag } from "@/components/price-tag";
import { PageHero } from "@/components/page-hero";
import { TrustBadge } from "@/components/trust-badge";
import { getProducts } from "@/lib/catalog";

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const firstProduct = getProducts()[0];

  // Sample price objects for PriceTag
  const oneTime = { price: 149, mode: "payment" as const, interval: undefined };
  const monthly = { price: 29, mode: "subscription" as const, interval: "month" as const };
  const yearly = { price: 299, mode: "subscription" as const, interval: "year" as const };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-content px-5 py-16 md:px-8">
        <h1 className="mb-2 font-display text-4xl font-bold text-brand">Component Styleguide</h1>
        <p className="mb-12 text-lg text-muted">Dev-only page — not visible in production.</p>

        {/* ── Button ─────────────────────────────────────── */}
        <section aria-labelledby="sg-buttons" className="mb-16">
          <h2 id="sg-buttons" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            Button
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Variants — default size</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="accent">Accent</Button>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Sizes — primary variant</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="default">Default</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">All variant × size combos</h3>
              <div className="grid gap-3">
                {(["primary", "outline", "ghost", "accent"] as const).map((variant) => (
                  <div key={variant} className="flex flex-wrap items-center gap-3">
                    <span className="w-20 text-xs text-muted capitalize">{variant}</span>
                    {(["sm", "default", "lg"] as const).map((size) => (
                      <Button key={size} variant={variant} size={size}>
                        {size}
                      </Button>
                    ))}
                    <Button variant={variant} disabled>
                      Disabled
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CtaButton ──────────────────────────────────── */}
        <section aria-labelledby="sg-cta-button" className="mb-16">
          <h2 id="sg-cta-button" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            CtaButton
          </h2>
          <div className="flex flex-wrap gap-3">
            <CtaButton href="/contact" variant="primary">Get Certified</CtaButton>
            <CtaButton href="/contact" variant="outline">Learn More</CtaButton>
            <CtaButton href="/contact" variant="ghost">Ghost CTA</CtaButton>
            <CtaButton href="/contact" variant="accent">Accent CTA</CtaButton>
            <CtaButton href="https://example.com" variant="primary">External Link</CtaButton>
          </div>
        </section>

        {/* ── Section ────────────────────────────────────── */}
        <section aria-labelledby="sg-section" className="mb-16">
          <h2 id="sg-section" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            Section
          </h2>
          <div className="rounded-xl border border-line overflow-hidden">
            <Section
              eyebrow="Eyebrow text"
              title="Section title renders as h2"
              intro="This is the optional intro paragraph rendered below the title. It supports longer descriptive copy about the section."
            >
              <p className="text-muted">Section children go here — cards, grids, or any content.</p>
            </Section>
          </div>
          <div className="mt-4 rounded-xl border border-line overflow-hidden">
            <Section surface compact title="Compact + surface variant">
              <p className="text-muted">Compact vertical padding, surface background.</p>
            </Section>
          </div>
        </section>

        {/* ── StatCard ───────────────────────────────────── */}
        <section aria-labelledby="sg-stat-card" className="mb-16">
          <h2 id="sg-stat-card" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            StatCard
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard value="2,500+" label="Certified Professionals" sublabel="Across Arizona" />
            <StatCard value="98%" label="Pass Rate" sublabel="First attempt" />
            <StatCard value="30+" label="Years of Service" />
          </div>
        </section>

        {/* ── ServiceCard ────────────────────────────────── */}
        <section aria-labelledby="sg-service-card" className="mb-16">
          <h2 id="sg-service-card" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            ServiceCard
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              icon={Award}
              title="Initial Certification"
              description="Begin your professional certification journey with ABCAC's initial certification program for addiction counselors."
              href="/initial-certification"
              linkLabel="Get started"
            />
            <ServiceCard
              icon={Award}
              title="Certification Renewal"
              description="Maintain your credentials with our streamlined renewal process. Includes CEU tracking and exam scheduling."
              href="/certification-renewal"
            />
            <ServiceCard
              icon={Award}
              title="No link variant"
              description="This card has no href and therefore renders no link — used for display-only service descriptions."
            />
          </div>
        </section>

        {/* ── ProductCard ────────────────────────────────── */}
        <section aria-labelledby="sg-product-card" className="mb-16">
          <h2 id="sg-product-card" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            ProductCard
          </h2>
          {firstProduct ? (
            <div className="max-w-sm">
              <ProductCard product={firstProduct} />
            </div>
          ) : (
            <p className="text-muted">No products found in catalog.</p>
          )}
        </section>

        {/* ── PriceTag ───────────────────────────────────── */}
        <section aria-labelledby="sg-price-tag" className="mb-16">
          <h2 id="sg-price-tag" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            PriceTag
          </h2>
          <div className="flex flex-wrap items-baseline gap-8">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">One-time</p>
              <PriceTag product={oneTime} className="text-2xl" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Monthly</p>
              <PriceTag product={monthly} className="text-2xl" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Yearly</p>
              <PriceTag product={yearly} className="text-2xl" />
            </div>
          </div>
        </section>

        {/* ── PageHero ───────────────────────────────────── */}
        <section aria-labelledby="sg-page-hero" className="mb-16">
          <h2 id="sg-page-hero" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            PageHero
          </h2>
          <p className="mb-4 text-sm text-muted">
            Note: PageHero renders an{" "}
            <code className="rounded bg-line px-1 font-mono text-xs">h1</code>. On this styleguide page the{" "}
            <code className="rounded bg-line px-1 font-mono text-xs">h1</code> above already exists, so the example
            below is wrapped to avoid a heading hierarchy conflict in production pages.
          </p>
          <div className="rounded-xl border border-line overflow-hidden">
            <PageHero
              eyebrow="Eyebrow"
              title="Page hero title (h1 in real pages)"
              intro="Optional intro copy displayed below the title, up to two lines of descriptive text about this page."
            >
              <CtaButton href="/contact" size="lg">Primary CTA</CtaButton>
            </PageHero>
          </div>
        </section>

        {/* ── TrustBadge ─────────────────────────────────── */}
        <section aria-labelledby="sg-trust-badge" className="mb-16">
          <h2 id="sg-trust-badge" className="mb-6 border-b border-line pb-2 text-2xl font-bold">
            TrustBadge
          </h2>
          <div className="max-w-md">
            <TrustBadge />
          </div>
        </section>
      </div>
    </main>
  );
}
