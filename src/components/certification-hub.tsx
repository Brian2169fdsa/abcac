"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Award, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// One Certification tab, two paths. Step 1: Initial or Recertification.
// Step 2: pick the credential. Then the digital application flow opens.

const INITIAL_CREDENTIALS: Array<{ value: string; label: string }> = [
  { value: "initial:cac", label: "CAC — Certified Addiction Counselor" },
  { value: "initial:cadac", label: "CADAC — Certified Alcohol & Drug Abuse Counselor" },
  { value: "initial:aadc", label: "AADC — Advanced Alcohol & Drug Abuse Counselor" },
  { value: "initial:ccs", label: "CCS — Certified Clinical Supervisor" },
  { value: "initial:ccjp", label: "CCJP — Certified Criminal Justice Professional" },
  { value: "initial:cprs", label: "CPRS — Certified Peer Recovery Specialist" },
  { value: "initial:cps", label: "CPS — Certified Prevention Specialist" },
];

const RENEWAL_CREDENTIALS: Array<{ value: string; label: string }> = [
  { value: "renewal:counselor", label: "CAC / CADAC / AADC — Counselor Recertification" },
  { value: "renewal:ccs", label: "CCS — Clinical Supervisor Recertification" },
  { value: "renewal:ccjp", label: "CCJP — Criminal Justice Recertification" },
  { value: "renewal:cprs", label: "CPRS — Peer Recovery Recertification" },
  { value: "renewal:cps", label: "CPS — Prevention Specialist Recertification" },
];

export function CertificationHub() {
  const router = useRouter();
  const [path, setPath] = useState<"initial" | "renewal" | null>(null);
  const [workflow, setWorkflow] = useState("");
  const options = path === "initial" ? INITIAL_CREDENTIALS : RENEWAL_CREDENTIALS;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => { setPath("initial"); setWorkflow(""); }}
          aria-pressed={path === "initial"}
          className={cn(
            "rounded-2xl border-2 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
            path === "initial" ? "border-brand bg-brand/[0.05]" : "border-line bg-surface hover:border-brand/40",
          )}
        >
          <Award className="h-9 w-9 text-brand" aria-hidden />
          <h2 className="mt-3 text-xl font-bold text-ink">Initial Certification</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Applying for your first ABCAC credential. Complete the application packet, gather signatures, pay the
            fee, and get approved for the IC&amp;RC exam.
          </p>
        </button>
        <button
          type="button"
          onClick={() => { setPath("renewal"); setWorkflow(""); }}
          aria-pressed={path === "renewal"}
          className={cn(
            "rounded-2xl border-2 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
            path === "renewal" ? "border-brand bg-brand/[0.05]" : "border-line bg-surface hover:border-brand/40",
          )}
        >
          <RefreshCcw className="h-9 w-9 text-brand" aria-hidden />
          <h2 className="mt-3 text-xl font-bold text-ink">Recertification</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Renewing an active credential. Every ABCAC certification renews every two years with 40 CE hours
            (3 Ethics + 3 Cultural Diversity) and the $150 renewal fee.
          </p>
        </button>
      </div>

      {path && (
        <div className="rounded-2xl border border-brand/15 bg-surface p-6 shadow-sm">
          <h3 className="text-lg font-bold text-ink">
            {path === "initial" ? "Which certification are you applying for?" : "Which credential are you renewing?"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Credential</span>
              <select
                value={workflow}
                onChange={(event) => setWorkflow(event.target.value)}
                className="h-12 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm"
              >
                <option value="">— Select your credential —</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <Button
              size="lg"
              disabled={!workflow}
              onClick={() => workflow && router.push(`/account/forms?workflow=${encodeURIComponent(workflow)}`)}
            >
              {path === "initial" ? "Start Application" : "Start Recertification"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {path === "renewal" && (
            <p className="mt-3 text-xs text-muted">
              You can pay the $150 renewal fee any time from the{" "}
              <a href="/account/payments?product=certification-renewal-2-year-credential-renewal-fee" className="font-semibold text-brand">Payments page</a>
              {" "}— your packet and payment are matched to your account automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
