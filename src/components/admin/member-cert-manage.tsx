"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  updateCertification,
  setCertStatus,
  toggleCertSync,
} from "@/app/(admin)/admin/members/[id]/cert-actions";

const field =
  "h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const STATUSES = ["active", "expired", "revoked"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-red-100 text-red-800",
};

function fmtDateInput(v: string | null | undefined): string {
  if (!v) return "";
  // Accept either a date (YYYY-MM-DD) or an ISO timestamp; keep the date part.
  return String(v).slice(0, 10);
}

type Cert = {
  id: string;
  cert_type?: string | null;
  cert_number?: string | null;
  issued_date?: string | null;
  expiration_date?: string | null;
  ic_rc_level?: string | null;
  status?: string | null;
  sync_enabled?: boolean | null;
};

export function MemberCertManage({
  memberId,
  certs,
}: {
  memberId: string;
  certs: any[];
}) {
  if (!certs || certs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">
          This member has no certifications yet. Issue one from the Issue
          Certification form.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(certs as Cert[]).map((c) => (
        <CertRow key={c.id} memberId={memberId} cert={c} />
      ))}
    </div>
  );
}

function CertRow({ memberId, cert }: { memberId: string; cert: Cert }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const [certNumber, setCertNumber] = useState(cert.cert_number ?? "");
  const [issuedDate, setIssuedDate] = useState(fmtDateInput(cert.issued_date));
  const [expirationDate, setExpirationDate] = useState(
    fmtDateInput(cert.expiration_date),
  );
  const [icRcLevel, setIcRcLevel] = useState(cert.ic_rc_level ?? "");

  const status = (cert.status ?? "active") as string;
  const syncEnabled = Boolean(cert.sync_enabled);

  function flash(ok: boolean, text: string) {
    setIsError(!ok);
    setMsg(text);
  }

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateCertification(memberId, cert.id, {
        cert_number: certNumber,
        issued_date: issuedDate,
        expiration_date: expirationDate,
        ic_rc_level: icRcLevel,
      });
      if (res.ok) {
        flash(true, "Saved.");
        router.refresh();
      } else {
        flash(false, "Failed: " + res.error);
      }
    });
  }

  function onStatusChange(next: Status) {
    if (next === status) return;
    // Confirm destructive lifecycle transitions.
    if (next === "revoked" || next === "expired") {
      const verb = next === "revoked" ? "revoke" : "expire";
      const ok = window.confirm(
        `Are you sure you want to ${verb} this ${cert.cert_type ?? "certification"}? The member will see the updated status.`,
      );
      if (!ok) return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await setCertStatus(memberId, cert.id, next);
      if (res.ok) {
        flash(true, `Status set to ${next}.`);
        router.refresh();
      } else {
        flash(false, "Failed: " + res.error);
      }
    });
  }

  function onToggleSync() {
    const next = !syncEnabled;
    setMsg(null);
    startTransition(async () => {
      const res = await toggleCertSync(memberId, cert.id, next);
      if (res.ok) {
        flash(true, next ? "Sync enabled." : "Sync disabled.");
        router.refresh();
      } else {
        flash(false, "Failed: " + res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">
            {cert.cert_type ?? "Certification"}
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
              STATUS_STYLES[status] ?? "bg-line text-muted"
            }`}
          >
            {status}
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold">Sync</span>
          <button
            type="button"
            role="switch"
            aria-checked={syncEnabled}
            aria-label="Toggle certification sync"
            onClick={onToggleSync}
            disabled={pending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              syncEnabled ? "bg-brand" : "bg-line"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                syncEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-muted">{syncEnabled ? "On" : "Off"}</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Certificate Number
          </span>
          <input
            className={field}
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            placeholder="e.g. 123456"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            IC&amp;RC Level
          </span>
          <input
            className={field}
            value={icRcLevel}
            onChange={(e) => setIcRcLevel(e.target.value)}
            placeholder="e.g. Level II"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Issued Date</span>
          <input
            type="date"
            className={field}
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">
            Expiration Date
          </span>
          <input
            type="date"
            className={field}
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Status</span>
          <select
            className={`${field} w-44`}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as Status)}
            disabled={pending}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3">
          {msg && (
            <span
              className={`text-sm ${isError ? "text-destructive" : "text-muted"}`}
            >
              {msg}
            </span>
          )}
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
