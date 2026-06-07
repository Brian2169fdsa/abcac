"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export interface ScheduleRow {
  id: string;
  credential_type: string;
  renewal_cycle_months: number;
  ceu_total_required: number;
  ceu_ethics_required: number;
  ceu_cultural_required: number;
  grace_period_days: number;
  notes: string | null;
}

/** Default-shaped credentials so an admin can add a missing row in one click. */
const KNOWN_CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"] as const;

function numFrom(form: HTMLFormElement, name: string, fallback: number): number {
  const raw = (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** One inline-editable row of the cert_schedules table. */
function ScheduleEditRow({ row }: { row: ScheduleRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setIsError(false);
    setBusy(true);
    const f = e.currentTarget;
    const patch = {
      renewal_cycle_months: numFrom(f, "renewal_cycle_months", row.renewal_cycle_months),
      ceu_total_required: numFrom(f, "ceu_total_required", row.ceu_total_required),
      ceu_ethics_required: numFrom(f, "ceu_ethics_required", row.ceu_ethics_required),
      ceu_cultural_required: numFrom(f, "ceu_cultural_required", row.ceu_cultural_required),
      grace_period_days: numFrom(f, "grace_period_days", row.grace_period_days),
      notes: (f.elements.namedItem("notes") as HTMLInputElement).value.trim() || null,
    };
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("cert_schedules")
        .update(patch)
        .eq("id", row.id);
      if (error) {
        setMsg("Failed: " + error.message);
        setIsError(true);
        return;
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "cert_schedule_updated",
          target_table: "cert_schedules",
          target_id: row.id,
          details: { credential_type: row.credential_type, ...patch },
        });
      } catch { /* best-effort */ }
      setMsg("Saved.");
      setIsError(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="px-4 py-3 font-semibold text-ink">{row.credential_type}</td>
      <td className="px-2 py-3">
        <form id={`sf-${row.id}`} onSubmit={onSubmit} className="contents" />
        <input form={`sf-${row.id}`} name="renewal_cycle_months" type="number" min={1}
          defaultValue={row.renewal_cycle_months} className={`${field} w-20`} />
      </td>
      <td className="px-2 py-3">
        <input form={`sf-${row.id}`} name="ceu_total_required" type="number" min={0}
          defaultValue={row.ceu_total_required} className={`${field} w-20`} />
      </td>
      <td className="px-2 py-3">
        <input form={`sf-${row.id}`} name="ceu_ethics_required" type="number" min={0}
          defaultValue={row.ceu_ethics_required} className={`${field} w-16`} />
      </td>
      <td className="px-2 py-3">
        <input form={`sf-${row.id}`} name="ceu_cultural_required" type="number" min={0}
          defaultValue={row.ceu_cultural_required} className={`${field} w-16`} />
      </td>
      <td className="px-2 py-3">
        <input form={`sf-${row.id}`} name="grace_period_days" type="number" min={0}
          defaultValue={row.grace_period_days} className={`${field} w-16`} />
      </td>
      <td className="px-2 py-3">
        <input form={`sf-${row.id}`} name="notes" defaultValue={row.notes ?? ""}
          className={`${field} min-w-[12rem]`} placeholder="notes" />
      </td>
      <td className="px-2 py-3">
        <Button form={`sf-${row.id}`} type="submit" size="sm" disabled={busy}>Save</Button>
        {msg && <p className={`mt-1 text-xs ${isError ? "text-destructive" : "text-muted"}`}>{msg}</p>}
      </td>
    </tr>
  );
}

/** Add-a-new-credential-schedule form. */
function AddScheduleForm({ existing }: { existing: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const missing = KNOWN_CREDENTIALS.filter((c) => !existing.includes(c));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setIsError(false);
    const f = e.currentTarget;
    const credential = (f.elements.namedItem("credential_type") as HTMLInputElement).value.trim();
    if (!credential) {
      setMsg("Enter a credential type.");
      setIsError(true);
      return;
    }
    setBusy(true);
    const insert = {
      credential_type: credential,
      renewal_cycle_months: numFrom(f, "renewal_cycle_months", 24),
      ceu_total_required: numFrom(f, "ceu_total_required", 40),
      ceu_ethics_required: numFrom(f, "ceu_ethics_required", 3),
      ceu_cultural_required: numFrom(f, "ceu_cultural_required", 3),
      grace_period_days: numFrom(f, "grace_period_days", 0),
      notes: (f.elements.namedItem("notes") as HTMLInputElement).value.trim() || null,
    };
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("cert_schedules")
        .insert(insert)
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
          action: "cert_schedule_created",
          target_table: "cert_schedules",
          target_id: data?.id ?? null,
          details: insert,
        });
      } catch { /* best-effort */ }
      f.reset();
      setMsg(`${credential} schedule added.`);
      setIsError(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-bold">Add a credential schedule</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Credential type</span>
          <input name="credential_type" className={field} list="known-credentials" placeholder="e.g. CAC" />
          <datalist id="known-credentials">
            {missing.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Renewal cycle (months)</span>
          <input name="renewal_cycle_months" type="number" min={1} defaultValue={24} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">CEU total required</span>
          <input name="ceu_total_required" type="number" min={0} defaultValue={40} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Ethics required</span>
          <input name="ceu_ethics_required" type="number" min={0} defaultValue={3} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Cultural Diversity required</span>
          <input name="ceu_cultural_required" type="number" min={0} defaultValue={3} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Grace period (days)</span>
          <input name="grace_period_days" type="number" min={0} defaultValue={0} className={field} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Notes <span className="font-normal text-muted">(optional)</span></span>
        <input name="notes" className={field} placeholder="Short description of this credential's rules" />
      </label>
      {msg && <p className={`text-sm ${isError ? "text-destructive" : "text-muted"}`}>{msg}</p>}
      <Button type="submit" disabled={busy}>Add schedule</Button>
    </form>
  );
}

export function ScheduleEditor({ schedules }: { schedules: ScheduleRow[] }) {
  const existing = schedules.map((s) => s.credential_type);
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Credential</th>
              <th className="px-2 py-3">Cycle (mo)</th>
              <th className="px-2 py-3">CEU total</th>
              <th className="px-2 py-3">Ethics</th>
              <th className="px-2 py-3">Cultural</th>
              <th className="px-2 py-3">Grace (d)</th>
              <th className="px-2 py-3">Notes</th>
              <th className="px-2 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No cert schedules yet. Add one below.</td></tr>
            ) : (
              schedules.map((row) => <ScheduleEditRow key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
      <AddScheduleForm existing={existing} />
    </div>
  );
}
