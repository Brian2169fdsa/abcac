"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { CtaButton } from "@/components/cta-button";
import { portalGatewayHref } from "@/lib/portal-routing";

const UNIT_PRICE = 15;
const MIN_CREDENTIALS = 2;
const MAX_CREDENTIALS = 6;
const MAX_MONTHS = 120;

/**
 * Estimates the fee the same way the portal computes it for real: each
 * credential you're syncing has its OWN months-to-move-forward (the one
 * already at the target date needs 0), and the fee is $15 times the SUM
 * across every credential — not a flat per-credential add-on. Two
 * credentials where only one needs to move costs the same as it always did;
 * three or more where several move at once now price correctly instead of
 * only ever asking for a single "months" number.
 */
export function CertificationSyncCalculator() {
  const [months, setMonths] = useState<number[]>([0, 0]);

  function clampMonths(next: number) {
    return Math.min(MAX_MONTHS, Math.max(0, Math.trunc(next) || 0));
  }

  function updateAt(index: number, next: number) {
    setMonths((current) => current.map((value, i) => (i === index ? clampMonths(next) : value)));
  }

  function addCredential() {
    setMonths((current) => (current.length >= MAX_CREDENTIALS ? current : [...current, 0]));
  }

  function removeCredential(index: number) {
    setMonths((current) => (current.length <= MIN_CREDENTIALS ? current : current.filter((_, i) => i !== index)));
  }

  const totalMonths = months.reduce((sum, value) => sum + value, 0);
  const totalFee = totalMonths * UNIT_PRICE;

  return (
    <div className="rounded-3xl border border-brand/15 bg-surface p-6 shadow-[0_28px_80px_-48px_rgba(13,34,63,0.5)] sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Payment calculator</p>
      <h2 className="mt-3 text-3xl">Calculate your one-time sync fee</h2>
      <p className="mt-3 text-muted">
        Add each credential you want to synchronize and enter how many months it needs to move forward — the one
        already at your target date needs 0. ABCAC charges $15 for each month, added across every credential.
      </p>

      <div className="mt-7 space-y-3">
        {months.map((value, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
            <span className="w-24 shrink-0 text-sm font-semibold text-ink sm:w-32">Credential {index + 1}</span>
            <div className="flex flex-1 items-center rounded-lg border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => updateAt(index, value - 1)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brand transition hover:bg-brand/10"
                aria-label={`Decrease months for credential ${index + 1}`}
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <input
                type="number"
                min={0}
                max={MAX_MONTHS}
                value={value}
                onChange={(event) => updateAt(index, Number(event.target.value))}
                aria-label={`Months to move forward for credential ${index + 1}`}
                className="h-9 min-w-0 flex-1 bg-transparent px-2 text-center text-lg font-bold text-ink outline-none"
              />
              <button
                type="button"
                onClick={() => updateAt(index, value + 1)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-brand transition hover:bg-brand/10"
                aria-label={`Increase months for credential ${index + 1}`}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-semibold text-muted sm:w-20">${value * UNIT_PRICE}</span>
            {months.length > MIN_CREDENTIALS && (
              <button
                type="button"
                onClick={() => removeCredential(index)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-brand/10 hover:text-brand"
                aria-label={`Remove credential ${index + 1}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>

      {months.length < MAX_CREDENTIALS && (
        <button
          type="button"
          onClick={addCredential}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add another credential
        </button>
      )}

      <div className="mt-6 flex items-center justify-between rounded-xl bg-info px-6 py-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">One-time total</p>
          <p className="text-xs text-white/60">{totalMonths} month{totalMonths === 1 ? "" : "s"} total across {months.length} credential{months.length === 1 ? "" : "s"}</p>
        </div>
        <p className="text-3xl font-bold">${totalFee}.00</p>
      </div>

      <p className="mt-4 rounded-xl bg-brand/[0.06] p-4 text-sm leading-relaxed text-muted">
        Example: syncing 3 credentials that each need to move forward 4, 2, and 0 months costs (4 + 2 + 0) × $15 =
        $90. This service is not a $15 monthly subscription. In your account, select the credentials to synchronize
        and ABCAC calculates the exact months and fee from their real expiration dates.
      </p>
      <CtaButton href={portalGatewayHref("/account/certification-sync")} size="lg" className="mt-6 w-full justify-center">
        Start your sync request
      </CtaButton>
    </div>
  );
}
