import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { CtaButton } from "@/components/cta-button";

export const metadata = { title: "Payment Confirmed" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  let productName: string | null = null;
  let isCeu = false;

  if (isStripeConfigured && searchParams.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      productName = session.metadata?.product_name ?? null;
      isCeu = Boolean(session.metadata?.ceu_note);
    } catch {
      // Ignore — show the generic confirmation.
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 text-center md:px-8 md:py-20">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
      <h1 className="mt-6">Payment confirmed</h1>
      <p className="mt-4 text-lg text-muted">
        Thank you{productName ? ` for your ${productName} payment` : ""}. A receipt has been emailed to you.
      </p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-5 text-left sm:p-6">
        <h2 className="text-lg">What happens next</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>ABCAC will process your request and follow up by email.</li>
          {isCeu && (
            <li>
              Submit your workshop materials to <span className="font-semibold text-ink">abcac@abcac.org</span>.
              Standard review turnaround is 4 weeks.
            </li>
          )}
          <li>You can view your credential status and payment history in your member account.</li>
        </ul>
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <CtaButton href="/account" className="w-full sm:w-auto">Go to My Account</CtaButton>
        <Link href="/store" className="inline-flex h-11 items-center justify-center px-5 font-semibold text-brand hover:text-brand-600">
          Back to store
        </Link>
      </div>
    </div>
  );
}
