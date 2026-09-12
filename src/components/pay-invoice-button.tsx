"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PAYMENTS_PAUSED_TITLE, paymentsEnabled } from "@/lib/feature-flags";

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);
  if (!paymentsEnabled) {
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800" title="Pay by check or money order until online payment opens.">{PAYMENTS_PAUSED_TITLE}</span>;
  }
  async function pay() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/invoice-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      alert(data.error === "payments_not_configured" || data.error === "payments_paused" ? "Online payment isn't enabled yet — please contact ABCAC." : "Could not start checkout.");
    } catch {
      alert("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }
  return <Button size="sm" variant="accent" onClick={pay} disabled={loading}>{loading ? "…" : "Pay Now"}</Button>;
}
