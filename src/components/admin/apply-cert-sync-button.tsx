"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyCertSync } from "@/app/(admin)/admin/members/[id]/cert-actions";

/** One-click "Apply synchronized dates" for a paid/under-review cert_sync application. */
export function ApplyCertSyncButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!window.confirm("Apply the synchronized expiration date to these certifications and approve this application?")) return;
    setBusy(true);
    setError(null);
    const result = await applyCertSync(applicationId);
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div>
      <Button size="sm" onClick={apply} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Apply synchronized dates"}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
