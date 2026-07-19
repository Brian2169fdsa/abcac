"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTestingRequest } from "@/app/(admin)/admin/testing/actions";

export function TestingRequestActions({ id, status, initialReference, initialNote }: { id: string; status: string; initialReference?: string | null; initialNote?: string | null }) {
  const router = useRouter();
  const [reference, setReference] = useState(initialReference ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  async function run(next: "processing" | "pre_registered" | "on_hold" | "cancelled") {
    setLoading(next); setError("");
    const result = await updateTestingRequest(id, next, reference, note);
    if (!result.ok) setError(result.error); else router.refresh();
    setLoading("");
  }
  return <div className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-xl">SMT processing</h2><label className="mt-4 block text-sm font-semibold">SMT candidate / registration reference<input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 outline-none focus:border-brand" /></label><label className="mt-4 block text-sm font-semibold">Staff or member-facing note<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 h-28 w-full rounded-xl border border-line bg-bg p-3 outline-none focus:border-brand" /></label>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-5 flex flex-wrap gap-2">{status !== "processing" && status !== "pre_registered" && <Button variant="outline" onClick={() => run("processing")} disabled={Boolean(loading)}>{loading === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start processing"}</Button>}<Button onClick={() => run("pre_registered")} disabled={Boolean(loading)}>{loading === "pre_registered" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark pre-registered & notify"}</Button><Button variant="outline" onClick={() => run("on_hold")} disabled={Boolean(loading)}>{loading === "on_hold" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request information"}</Button><Button variant="outline" onClick={() => run("cancelled")} disabled={Boolean(loading)}>{loading === "cancelled" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel request"}</Button></div></div>;
}
