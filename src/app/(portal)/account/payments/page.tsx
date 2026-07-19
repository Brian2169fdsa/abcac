import Link from "next/link";
import { requireUserId } from "@/lib/auth/current-user";
import { getProducts } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { PortalProductPay } from "@/components/portal-product-pay";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

// All ABCAC payments happen here, inside the member portal, tied to the
// signed-in account — application fees, renewals, testing, CEU endorsement,
// and services. Workflow-specific payments (exam pre-registration, cert sync,
// reciprocity, admin invoices) start from their own pages and flow through the
// same checkout.
export default async function PortalPaymentsPage({ searchParams }: { searchParams: { product?: string; application?: string } }) {
  const uid = await requireUserId();
  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,email,phone")
    .eq("id", uid)
    .maybeSingle();

  const prefill = {
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: profile?.email,
    phone: profile?.phone,
  };

  const products = getProducts();
  const highlighted = searchParams.product ?? "";
  const applicationId = searchParams.application ?? "";
  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Payments"
        intro="Pay ABCAC fees securely from your account. Your details are pre-filled, every payment is attached to your member record, and receipts appear under Invoices & Receipts."
      />
      <Section compact>
        <div className="mb-8 flex flex-wrap gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
          <span className="font-semibold text-ink">Looking for a specific workflow?</span>
          <Link className="font-semibold text-brand hover:text-brand-600" href="/account/testing">Exam registration</Link>
          <Link className="font-semibold text-brand hover:text-brand-600" href="/account/certification-sync">Certification sync</Link>
          <Link className="font-semibold text-brand hover:text-brand-600" href="/account/requests">IC&amp;RC reciprocity</Link>
          <Link className="font-semibold text-brand hover:text-brand-600" href="/account/invoices">Invoices &amp; receipts</Link>
        </div>

        <div className="space-y-10">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="mb-4 text-2xl">{category}</h2>
              <div className="space-y-4">
                {products.filter((p) => p.category === category).map((product) => (
                  <PortalProductPay
                    key={product.slug}
                    product={product}
                    prefill={prefill}
                    defaultOpen={product.slug === highlighted}
                    applicationId={product.slug === highlighted ? applicationId : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-line bg-bg p-5 text-sm text-muted">
          Prefer to pay by check or money order? Mail it payable to &ldquo;ABCAC&rdquo; at PO Box 83165, Phoenix, AZ 85071 —
          or <Link href="/contact" className="font-semibold text-brand">contact us</Link> with any billing question.
          <Link href="/account/invoices" className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-3`}>View payment history</Link>
        </div>
      </Section>
    </>
  );
}
