"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CtaButton } from "@/components/cta-button";

const UNIT_PRICE = 15;

export function CertificationSyncCalculator() {
  const [months, setMonths] = useState(1);

  function updateMonths(next: number) {
    setMonths(Math.min(120, Math.max(1, Math.trunc(next))));
  }

  return (
    <div className="rounded-3xl border border-brand/15 bg-surface p-6 shadow-[0_28px_80px_-48px_rgba(13,34,63,0.5)] sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">Payment calculator</p>
      <h2 className="mt-3 text-3xl">Calculate your one-time sync fee</h2>
      <p className="mt-3 text-muted">
        Enter the number of months the earlier credential must move forward. ABCAC charges $15 for each month adjusted.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="sync-months" className="text-sm font-semibold text-ink">Months to move forward</label>
          <div className="mt-2 flex items-center rounded-xl border border-line bg-bg p-1">
            <button
              type="button"
              onClick={() => updateMonths(months - 1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand transition hover:bg-brand/10"
              aria-label="Decrease months"
            >
              <Minus className="h-5 w-5" aria-hidden />
            </button>
            <input
              id="sync-months"
              type="number"
              min={1}
              max={120}
              value={months}
              onChange={(event) => updateMonths(Number(event.target.value) || 1)}
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-center text-xl font-bold text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => updateMonths(months + 1)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand transition hover:bg-brand/10"
              aria-label="Increase months"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="rounded-xl bg-info px-6 py-4 text-white sm:min-w-48">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">One-time total</p>
          <p className="mt-1 text-3xl font-bold">${months * UNIT_PRICE}.00</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-brand/[0.06] p-4 text-sm leading-relaxed text-muted">
        Example: moving a credential 6 months forward costs $90. This service is not a $15 monthly subscription.
      </p>
      <CtaButton href={`/store/certification-sync?quantity=${months}`} size="lg" className="mt-6 w-full justify-center">
        Continue with {months} {months === 1 ? "month" : "months"}
      </CtaButton>
    </div>
  );
}
