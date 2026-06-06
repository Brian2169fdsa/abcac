"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function FulfillRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("document_requests")
        .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        alert("Update failed: " + error.message);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="primary" onClick={onClick} disabled={busy}>
      Fulfill
    </Button>
  );
}
