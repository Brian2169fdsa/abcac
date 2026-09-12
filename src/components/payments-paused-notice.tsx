import Link from "next/link";
import { PAYMENTS_PAUSED_BODY, PAYMENTS_PAUSED_TITLE } from "@/lib/feature-flags";

/** Shown wherever a Stripe button would appear while NEXT_PUBLIC_PAYMENTS_ENABLED=false. */
export function PaymentsPausedNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" className={`rounded-xl border border-amber-300 bg-amber-50 text-amber-950 ${compact ? "p-3 text-sm" : "p-5"}`}>
      <p className="font-bold">{PAYMENTS_PAUSED_TITLE}</p>
      <p className={`mt-1 leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>{PAYMENTS_PAUSED_BODY}</p>
      {!compact && (
        <p className="mt-2 text-sm">
          Questions? <Link href="/account/messages" className="font-semibold text-brand">Message ABCAC</Link>.
        </p>
      )}
    </div>
  );
}
