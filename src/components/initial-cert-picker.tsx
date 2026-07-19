"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CREDENTIALS: Array<{ value: string; label: string; blurb: string }> = [
  { value: "CAC", label: "CAC — Certified Addiction Counselor", blurb: "General application + CAC supplemental packet." },
  { value: "CADAC", label: "CADAC — Certified Alcohol & Drug Abuse Counselor", blurb: "General application + CADAC/AADC supplemental packet." },
  { value: "AADC", label: "AADC — Advanced Alcohol & Drug Abuse Counselor", blurb: "General application + CADAC/AADC supplemental packet." },
  { value: "CCS", label: "CCS — Certified Clinical Supervisor", blurb: "Clinical supervisor application packet." },
  { value: "CCJP", label: "CCJP — Certified Criminal Justice Professional", blurb: "Criminal justice professional application packet." },
  { value: "CPRS", label: "CPRS — Certified Peer Recovery Specialist", blurb: "Peer recovery specialist application packet." },
  { value: "CPS", label: "CPS — Certified Prevention Specialist", blurb: "Prevention specialist application packet." },
];

/** Credential selector for the Initial Certification page: the digital
 *  application packet appears only after the member chooses what they are
 *  applying for. */
export function InitialCertPicker() {
  const router = useRouter();
  const [credential, setCredential] = useState("");
  const picked = CREDENTIALS.find((c) => c.value === credential);

  return (
    <div className="rounded-2xl border border-brand/15 bg-surface p-6 shadow-sm">
      <h2 className="text-xl font-bold text-ink">Which certification are you applying for?</h2>
      <p className="mt-1 text-sm text-muted">
        Choose your credential and we&apos;ll open the exact application packet you need — every required form,
        kept together, with your progress saved as you go.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Credential</span>
          <select
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            className="h-12 w-full rounded-lg border border-line bg-bg px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-sm"
          >
            <option value="">— Select the certification you are applying for —</option>
            {CREDENTIALS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <Button
          size="lg"
          disabled={!credential}
          onClick={() => credential && router.push(`/account/forms?workflow=initial:${credential.toLowerCase()}`)}
        >
          Start Application <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {picked && <p className="mt-3 text-sm font-semibold text-brand">{picked.blurb}</p>}
      <p className="mt-3 text-xs text-muted">
        Applying for more than one credential? Complete one application at a time — your drafts are saved separately
        and you can start the next one as soon as you submit.
      </p>
    </div>
  );
}
