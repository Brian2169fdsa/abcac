"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TestingCheckoutButton({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setLoading(true); setError("");
    const response = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testingRequestId: requestId }) });
    const data = await response.json();
    if (!response.ok || !data.url) { setError("Payment could not start. Please try again."); setLoading(false); return; }
    window.location.href = data.url;
  }
  return <><Button onClick={checkout} disabled={loading} size="lg" className="mt-8 w-full">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue to secure payment"}</Button>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}</>;
}
