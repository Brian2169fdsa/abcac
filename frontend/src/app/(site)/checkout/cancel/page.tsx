import { XCircle } from "lucide-react";
import { CtaButton } from "@/components/cta-button";

export const metadata = { title: "Payment Cancelled" };

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-20 text-center md:px-8">
      <XCircle className="mx-auto h-14 w-14 text-muted" aria-hidden />
      <h1 className="mt-6">Payment cancelled</h1>
      <p className="mt-4 text-lg text-muted">
        No charge was made. You can return to the store and try again whenever you&apos;re ready.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <CtaButton href="/store">Return to store</CtaButton>
        <CtaButton href="/contact" variant="outline">Contact ABCAC</CtaButton>
      </div>
    </div>
  );
}
