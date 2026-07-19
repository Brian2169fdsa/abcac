import Link from "next/link";
import { LockKeyhole, UserRoundPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Public-site payment panel: the website is informative — payment happens
 *  inside the member portal, so this routes visitors to sign in or create an
 *  account and lands them on the portal Payments page with the product open. */
export function SignInToPay({ slug }: { slug: string }) {
  const next = encodeURIComponent(`/account/payments?product=${slug}`);
  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <div>
          <h3 className="text-base font-bold text-ink">Pay from your member account</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Payments are made inside the ABCAC member portal so every fee is attached to your record — with receipts,
            payment history, and application status all in one place.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <Link href={`/login?next=${next}`} className={buttonVariants({ size: "lg" })}>
          Sign In to Pay
        </Link>
        <Link href={`/signup?next=${next}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <UserRoundPlus className="h-4 w-4" aria-hidden /> Create Your Free Account
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Secure checkout powered by Stripe once you&apos;re signed in.</p>
    </div>
  );
}
