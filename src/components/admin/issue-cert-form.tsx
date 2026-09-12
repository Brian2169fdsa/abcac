"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"] as const;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];

/** An approved initial/renewal application with no certificate issued for it yet. */
export interface PendingIssuance {
  id: string;
  certType: string;
  appType: string;
  reviewedAt: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Adds `months` calendar months to an ISO date, returned as an ISO date. */
function addMonthsISO(dateISO: string, months: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function IssueCertForm({
  members,
  defaultMemberId,
  pendingApplications = [],
  scheduleMonths = {},
}: {
  members: { id: string; label: string }[];
  defaultMemberId?: string;
  /** Approved applications for this member still awaiting a certificate. */
  pendingApplications?: PendingIssuance[];
  /** credential_type -> renewal_cycle_months, from cert_schedules (falls back to 24). */
  scheduleMonths?: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [sourceApplicationId, setSourceApplicationId] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");

  function quickIssue(app: PendingIssuance) {
    const issued = todayISO();
    const months = scheduleMonths[app.certType] ?? 24;
    setSourceApplicationId(app.id);
    setCredential(app.certType);
    setIssuedDate(issued);
    setExpirationDate(addMonthsISO(issued, months));
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setIsError(false);

    const f = e.currentTarget;
    const memberId = (f.elements.namedItem("member") as HTMLSelectElement).value;
    const certNumber = (f.elements.namedItem("cert_number") as HTMLInputElement).value.trim();
    const icRcLevel = (f.elements.namedItem("ic_rc_level") as HTMLInputElement).value.trim();
    const file = (f.elements.namedItem("certificate_file") as HTMLInputElement).files?.[0];

    if (!memberId || !credential) {
      setMsg("Select a member and a credential.");
      setIsError(true);
      return;
    }

    if (file) {
      if (file.size > MAX_BYTES) {
        setMsg("Certificate file must be under 10MB.");
        setIsError(true);
        return;
      }
      if (!ALLOWED_EXT.includes((file.name.split(".").pop() || "").toLowerCase())) {
        setMsg("Certificate file must be a PDF, JPG, or PNG.");
        setIsError(true);
        return;
      }
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Upload the physical certificate (optional) to the existing private
      // member-documents bucket under <member_id>/certs/... so the member-read
      // policy (keyed on the leading folder = their uid) can serve it back.
      let certificatePath: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        certificatePath = `${memberId}/certs/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("member-documents")
          .upload(certificatePath, file, { upsert: false });
        if (upErr) {
          setMsg("Certificate file upload failed: " + upErr.message);
          setIsError(true);
          return;
        }
      }

      const { data: inserted, error } = await supabase
        .from("certifications")
        .insert({
          member_id: memberId,
          cert_type: credential,
          cert_number: certNumber || null,
          ic_rc_level: icRcLevel || null,
          issued_date: issuedDate || null,
          expiration_date: expirationDate || null,
          certificate_url: certificatePath,
          status: "active",
          source_application_id: sourceApplicationId,
        })
        .select("id")
        .single();

      if (error) {
        setMsg("Failed: " + error.message);
        setIsError(true);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "certification_issued",
          target_table: "certifications",
          target_id: inserted?.id ?? null,
          details: { member_id: memberId, cert_type: credential, source_application_id: sourceApplicationId },
        });
      } catch { /* best-effort */ }

      f.reset();
      setCredential("");
      setIssuedDate("");
      setExpirationDate("");
      setSourceApplicationId(null);
      setMsg(`${credential} certification issued successfully.`);
      setIsError(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border border-line bg-surface p-6">
      {pendingApplications.length > 0 && (
        <div className="rounded-lg border border-brand/20 bg-brand/[0.04] p-4">
          <div className="mb-2 text-sm font-semibold text-ink">Approved — awaiting a certificate</div>
          <div className="flex flex-wrap gap-2">
            {pendingApplications.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => quickIssue(app)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sourceApplicationId === app.id ? "border-brand bg-brand text-white" : "border-brand/30 bg-white text-brand hover:bg-brand/10"
                }`}
              >
                Issue {app.certType} ({app.appType === "renewal" ? "renewal" : "initial"})
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Fills the credential, issue date, and expiration below from that application. Confirm the certificate number, then issue.</p>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Member</span>
        <select name="member" className={field} defaultValue={defaultMemberId ?? ""}>
          <option value="" disabled>— Select member —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Credential</span>
        <select name="credential" className={field} value={credential} onChange={(e) => setCredential(e.target.value)}>
          <option value="" disabled>— Select credential —</option>
          {CREDENTIALS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Certificate Number</span>
          <input name="cert_number" className={field} placeholder="e.g. 123456" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">IC&amp;RC Level <span className="font-normal text-muted">(optional)</span></span>
          <input name="ic_rc_level" className={field} placeholder="e.g. Level II" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Issued Date</span>
          <input name="issued_date" type="date" className={field} value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Expiration Date</span>
          <input name="expiration_date" type="date" className={field} value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          Physical Certificate File <span className="font-normal text-muted">(optional — PDF/JPG/PNG, max 10MB)</span>
        </span>
        <input name="certificate_file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        <span className="mt-1 block text-xs text-muted">If attached, the member can download it from their Certificate &amp; Wallet Card page.</span>
      </label>

      {msg && (
        <p className={`text-sm ${isError ? "text-destructive" : "text-muted"}`}>{msg}</p>
      )}

      <Button type="submit" disabled={busy}>Issue Certification</Button>
    </form>
  );
}
