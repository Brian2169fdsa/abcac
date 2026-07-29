import { CheckCircle2 } from "lucide-react";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { CtaButton } from "@/components/cta-button";

export const metadata = { title: "Payment Confirmed" };

const portalDestinations = {
  "/account/testing": {
    label: "Track Exam Registration",
    record: "exam registration",
    next: "ABCAC staff will review your exam registration and complete your pre-registration with SMT.",
  },
  "/account/certification-sync": {
    label: "Track Certification Sync",
    record: "certification sync request",
    next: "ABCAC staff will review the dates and credentials attached to your synchronization request.",
  },
  "/account/requests": {
    label: "Track Reciprocity Request",
    record: "reciprocity request",
    next: "ABCAC staff will review the credential and destination attached to your reciprocity request.",
  },
  "/account/applications": {
    label: "Track Application",
    record: "application",
    next: "ABCAC staff will review the application packet and documents attached to this payment.",
  },
  "/account/payments": {
    label: "View Payments",
    record: "payment",
    next: "ABCAC staff will process the service request attached to this payment.",
  },
} as const;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  let productName: string | null = null;
  let isCeu = false;
  let isTesting = false;
  let portalReturnPath: keyof typeof portalDestinations = "/account/payments";

  if (isStripeConfigured && searchParams.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      productName = session.metadata?.product_name ?? null;
      isCeu = Boolean(session.metadata?.ceu_note);
      isTesting = session.metadata?.payment_type === "testing";
      const requestedReturnPath = session.metadata?.portal_return_path;
      if (requestedReturnPath && requestedReturnPath in portalDestinations) {
        portalReturnPath = requestedReturnPath as keyof typeof portalDestinations;
      }
    } catch {
      // Ignore — show the generic confirmation.
    }
  }
  const destination = portalDestinations[portalReturnPath];

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
          {isTesting ? (
            <>
              <li>ABCAC staff will review your exam registration and complete your pre-registration with SMT.</li>
              <li>
                We will notify you in the member portal and by email when pre-registration is complete. Then watch
                for an email from Schroeder Measurement Technologies (SMT) with your scheduling instructions.
              </li>
            </>
          ) : (
            <li>{destination.next}</li>
          )}
          {isCeu && (
            <li>
              Submit your workshop materials to <span className="font-semibold text-ink">abcac@abcac.org</span>.
              Standard review turnaround is 4 weeks.
            </li>
          )}
          <li>
            You can view your {destination.record} and payment history in your member account.
          </li>
        </ul>
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <CtaButton href={portalReturnPath} className="w-full sm:w-auto">
          {destination.label}
        </CtaButton>
        <CtaButton href="/account" variant="outline" className="w-full sm:w-auto">Go to My Account</CtaButton>
      </div>
    </div>
  );
}
