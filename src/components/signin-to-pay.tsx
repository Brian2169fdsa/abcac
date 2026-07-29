import Link from "next/link";
import { LockKeyhole, UserRoundPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { authHref, getProductPortalDestination } from "@/lib/portal-routing";

/** Public-site workflow panel: the website is informative, while applications,
 * requests, and payments are completed from the member's authenticated record. */
export function SignInToPay({ slug }: { slug: string }) {
  const destination = getProductPortalDestination(slug);
  const isDirectPayment = destination.startsWith("/account/payments");

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <div>
          <h3 className="text-base font-bold text-ink">
            {isDirectPayment ? "Pay from your member account" : "Continue in your member account"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {isDirectPayment
              ? "Payments are made inside the ABCAC member portal so every fee is attached to your record — with receipts and payment history in one place."
              : "Start the required form or request in the ABCAC member portal. Payment appears after the record is ready, keeping the application, receipt, and status connected."}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <Link href={authHref("login", destination)} className={buttonVariants({ size: "lg" })}>
          {isDirectPayment ? "Sign In to Pay" : "Sign In to Continue"}
        </Link>
        <Link href={authHref("signup", destination)} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <UserRoundPlus className="h-4 w-4" aria-hidden /> Create Your Free Account
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {isDirectPayment ? "Secure checkout powered by Stripe." : "Save your progress and return at any time."}
      </p>
    </div>
  );
}
