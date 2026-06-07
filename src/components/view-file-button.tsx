"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Opens a private storage file via a short-lived signed URL. */
export function ViewFileButton({ bucket, path, label = "View" }: { bucket: string; path: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error || !data) throw error || new Error("no url");
      window.open(data.signedUrl, "_blank");
    } catch {
      alert("Could not open the file.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={open} disabled={loading} className="text-sm font-semibold text-brand hover:text-brand-600 disabled:opacity-50">
      {loading ? "Opening…" : label}
    </button>
  );
}
