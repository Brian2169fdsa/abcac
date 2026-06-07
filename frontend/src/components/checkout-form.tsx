"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CREDENTIAL_LEVELS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];

interface CheckoutFormProps {
  slug: string;
  category: string;
  examMode: string | null;
}

export function CheckoutForm({ slug, category, examMode }: CheckoutFormProps) {
  const needsCredential = category === "Certification" || category === "Testing";
  const isCeu = category === "CEU Endorsement";

  const [credentialLevel, setCredentialLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setError(null);
    if (needsCredential && !credentialLevel) {
      setError("Please select your credential level.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, credentialLevel: credentialLevel || undefined, examMode: examMode || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(
          data.error === "payments_not_configured"
            ? "Online payment isn't enabled yet. Please contact ABCAC to complete this payment."
            : data.error === "price_not_found"
              ? "This item isn't available for checkout yet. Please contact ABCAC."
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
    <div className="rounded-xl border border-line bg-surface p-6">
      {needsCredential && (
        <div className="mb-4">
          <label htmlFor="credentialLevel" className="mb-1.5 block text-sm font-semibold">
            Credential level
          </label>
          <select
            id="credentialLevel"
            value={credentialLevel}
            onChange={(e) => setCredentialLevel(e.target.value)}
            className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

      {isCeu && (
        <p className="mb-4 rounded-lg bg-accent/10 p-3 text-sm text-muted">
          Submit workshop materials to <span className="font-semibold text-ink">abcac@abcac.org</span>. Standard review
          turnaround: 4 weeks.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <Button onClick={handleCheckout} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Proceed to Payment"}
      </Button>
      <p className="mt-3 text-center text-xs text-muted">Secure checkout powered by Stripe.</p>
    </div>
  );
}
