"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CREDENTIAL_LEVELS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];

export interface CheckoutPrefill {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CheckoutFormProps {
  slug: string;
  category: string;
  examMode: string | null;
  unitPrice?: number;
  initialQuantity?: number;
  /** Signed-in member details — pre-fills the payer form inside the portal. */
  prefill?: CheckoutPrefill;
}

export function CheckoutForm({ slug, category, examMode, unitPrice = 0, initialQuantity = 1, prefill }: CheckoutFormProps) {
  const needsCredential = category === "Certification" || category === "Testing";
  const isCeu = category === "CEU Endorsement";
  const isCertificationSync = slug === "certification-sync";

  const [credentialLevel, setCredentialLevel] = useState("");
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(Math.min(120, Math.max(1, Math.trunc(initialQuantity))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || phone.replace(/\D/g, "").length < 10) {
      setError("Please complete your name, email, and a valid phone number before continuing.");
      return;
    }
    if (needsCredential && !credentialLevel) {
      setError("Please select your credential level.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          credentialLevel: credentialLevel || undefined,
          examMode: examMode || undefined,
          quantity: isCertificationSync ? quantity : undefined,
          paymentForm: {
            firstName,
            lastName,
            email,
            phone,
            referenceNumber,
            notes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(
          data.error === "authentication_required"
            ? "Please sign in to your member account to complete this payment."
            : data.error === "payments_not_configured"
            ? "Online payment isn't enabled yet. Please contact ABCAC to complete this payment."
            : data.error === "price_not_found"
              ? "This item isn't available for checkout yet. Please contact ABCAC."
              : data.error === "payment_form_required"
                ? "Please complete the payment details form before continuing."
                : data.error === "payment_form_save_failed"
                  ? "We could not securely save your payment form. Please try again or contact ABCAC."
              : "Could not start checkout. Please try again.",
        );
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      {needsCredential && (
        <div className="mb-4">
          <label htmlFor="credentialLevel" className="mb-1.5 block text-sm font-semibold">
            Credential level
          </label>
          <select
            id="credentialLevel"
            value={credentialLevel}
            onChange={(e) => setCredentialLevel(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm"
          >
            <option value="">— Select —</option>
            {CREDENTIAL_LEVELS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {examMode && (
        <p className="mb-4 text-sm text-muted">
          Exam mode: <span className="font-semibold text-ink">{examMode}</span>
        </p>
      )}

      {isCertificationSync && (
        <div className="mb-5 rounded-xl border border-brand/15 bg-brand/[0.04] p-4">
          <label htmlFor="syncQuantity" className="block text-sm font-semibold text-ink">
            Months to move forward
          </label>
          <p className="mt-1 text-xs leading-relaxed text-muted">Each month is a one-time $15 adjustment. This is not a monthly subscription.</p>
          <div className="mt-3 flex items-center gap-4">
            <input
              id="syncQuantity"
              type="number"
              min={1}
              max={120}
              step={1}
              value={quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                setQuantity(Number.isFinite(next) ? Math.min(120, Math.max(1, Math.trunc(next))) : 1);
              }}
              className="h-11 w-28 rounded-lg border border-line bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <p className="text-sm text-muted">
              One-time total: <span className="text-lg font-bold text-brand">${(unitPrice * quantity).toFixed(2)}</span>
            </p>
          </div>
        </div>
      )}

      {isCeu && (
        <p className="mb-4 rounded-lg bg-accent/10 p-3 text-sm text-muted">
          Submit workshop materials to <span className="font-semibold text-ink">abcac@abcac.org</span>. Standard review
          turnaround: 4 weeks.
        </p>
      )}

      <div className="mb-5 border-t border-line pt-5">
        <h3 className="text-base font-bold text-ink">Payment details</h3>
        <p className="mt-1 text-sm text-muted">
          This information is attached to your Stripe payment so ABCAC can match and process it correctly.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="payerFirstName" className="mb-1.5 block text-sm font-semibold">First name</label>
            <input id="payerFirstName" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
          <div>
            <label htmlFor="payerLastName" className="mb-1.5 block text-sm font-semibold">Last name</label>
            <input id="payerLastName" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
          <div>
            <label htmlFor="payerEmail" className="mb-1.5 block text-sm font-semibold">Email</label>
            <input id="payerEmail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
          <div>
            <label htmlFor="payerPhone" className="mb-1.5 block text-sm font-semibold">Phone</label>
            <input id="payerPhone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="paymentReference" className="mb-1.5 block text-sm font-semibold">Certification, application, or reference number <span className="font-normal text-muted">(optional)</span></label>
            <input id="paymentReference" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="paymentNotes" className="mb-1.5 block text-sm font-semibold">Processing notes <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="paymentNotes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm" />
          </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Button onClick={handleCheckout} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Proceed to Payment"}
      </Button>
      <p className="mt-3 text-center text-xs text-muted">Secure checkout powered by Stripe.</p>
    </div>
  );
}
