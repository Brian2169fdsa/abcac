"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "ok" | "error";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function VerifyForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const val = (n: string) =>
      (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() ?? "";

    const payload = {
      requesterName: val("requesterName"),
      requesterEmail: val("requesterEmail"),
      organization: val("organization"),
      subjectName: val("subjectName"),
      subjectCertNumber: val("subjectCertNumber"),
      reason: val("reason"),
    };

    if (!payload.requesterName || !payload.requesterEmail || !payload.reason) {
      setStatus("error");
      setErrMsg("Please fill in your name, email, and reason for the request.");
      return;
    }
    if (!payload.subjectName && !payload.subjectCertNumber) {
      setStatus("error");
      setErrMsg("Enter the counselor's name and/or certification number to verify.");
      return;
    }

    setStatus("sending");
    setErrMsg("");
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      form.reset();
    } catch {
      setStatus("error");
      setErrMsg("Sorry, we could not submit your request. Please try again later.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-6 text-success">
        <p className="font-semibold">Request received.</p>
        <p className="mt-1 text-sm">
          Thank you. We have received your verification request and emailed a confirmation. Our team
          will review it and respond with the outcome.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requesterName" className="mb-1.5 block text-sm font-semibold">
            Your name
          </label>
          <input id="requesterName" name="requesterName" className={field} required />
        </div>
        <div>
          <label htmlFor="requesterEmail" className="mb-1.5 block text-sm font-semibold">
            Your email
          </label>
          <input id="requesterEmail" name="requesterEmail" type="email" className={field} required />
        </div>
      </div>

      <div>
        <label htmlFor="organization" className="mb-1.5 block text-sm font-semibold">
          Organization <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="organization" name="organization" className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="subjectName" className="mb-1.5 block text-sm font-semibold">
            Counselor&rsquo;s name
          </label>
          <input id="subjectName" name="subjectName" className={field} />
        </div>
        <div>
          <label htmlFor="subjectCertNumber" className="mb-1.5 block text-sm font-semibold">
            Certification number
          </label>
          <input id="subjectCertNumber" name="subjectCertNumber" className={field} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">Provide the counselor&rsquo;s name and/or their certification number.</p>

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold">
          Reason for verification
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          required
        />
      </div>

      {status === "error" && <p className="text-sm text-red-600">{errMsg}</p>}

      <Button type="submit" disabled={status === "sending"} size="lg">
        {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}
      </Button>
    </form>
  );
}
