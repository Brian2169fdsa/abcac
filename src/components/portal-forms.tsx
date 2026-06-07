"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const labelCls = "mb-1.5 block text-sm font-semibold";

function useInsert(table: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run(buildRow: (userId: string) => Record<string, unknown>) {
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return false; }
      const { error } = await supabase.from(table).insert(buildRow(user.id));
      if (error) throw error;
      setDone(true);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }
  return { run, loading, error, done, setDone };
}

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)} variant="outline" size="sm">{label}</Button>;
  return <div className="rounded-xl border border-line bg-surface p-6">{children}</div>;
}

// ─── Employment ───
export function AddEmploymentForm() {
  const { run, loading, error } = useInsert("employment_records");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const ok = await run((uid) => ({
      member_id: uid,
      employer_name: g("employer").value.trim(),
      position_title: g("position").value.trim(),
      start_date: g("start").value || null,
      end_date: g("current").checked ? null : g("end").value || null,
      is_current: g("current").checked,
    }));
    if (ok) f.reset();
  }
  return (
    <Collapsible label="+ Add Employment">
      <form onSubmit={onSubmit} className="space-y-4">
        <h3>Add Employment Record</h3>
        <label className="block"><span className={labelCls}>Employer *</span><input name="employer" className={field} required /></label>
        <label className="block"><span className={labelCls}>Position / Title *</span><input name="position" className={field} required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Start date</span><input name="start" type="date" className={field} /></label>
          <label className="block"><span className={labelCls}>End date</span><input name="end" type="date" className={field} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input name="current" type="checkbox" className="h-4 w-4" /> Currently employed here</label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Add Record"}</Button>
      </form>
    </Collapsible>
  );
}

// ─── Other certification ───
export function AddOtherCertForm() {
  const { run, loading, error } = useInsert("other_certifications");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const ok = await run((uid) => ({
      member_id: uid,
      credential_title: g("title").value.trim(),
      credential_number: g("number").value.trim() || null,
      issuing_board: g("board").value.trim(),
      issued_date: g("issued").value || null,
      expiration_date: g("expires").value || null,
    }));
    if (ok) f.reset();
  }
  return (
    <Collapsible label="+ Add Certification">
      <form onSubmit={onSubmit} className="space-y-4">
        <h3>Add Other Certification</h3>
        <label className="block"><span className={labelCls}>Credential title *</span><input name="title" className={field} required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Credential number</span><input name="number" className={field} /></label>
          <label className="block"><span className={labelCls}>Issuing board *</span><input name="board" className={field} required /></label>
          <label className="block"><span className={labelCls}>Issued</span><input name="issued" type="date" className={field} /></label>
          <label className="block"><span className={labelCls}>Expires</span><input name="expires" type="date" className={field} /></label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Add Certification"}</Button>
      </form>
    </Collapsible>
  );
}

// ─── Clinical supervision (keyed on supervisor_id) ───
export function AddSupervisionForm() {
  const { run, loading, error } = useInsert("supervision_records");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const end = g("end").value;
    const ok = await run((uid) => ({
      supervisor_id: uid,
      supervisee_name: g("name").value.trim(),
      supervisee_credential: g("cred").value.trim() || null,
      start_date: g("start").value || null,
      end_date: end || null,
      status: end ? "completed" : "active",
    }));
    if (ok) f.reset();
  }
  return (
    <Collapsible label="+ Add Supervision Record">
      <form onSubmit={onSubmit} className="space-y-4">
        <h3>Add Supervision Record</h3>
        <label className="block"><span className={labelCls}>Supervisee name *</span><input name="name" className={field} required /></label>
        <label className="block"><span className={labelCls}>Supervisee credential</span><input name="cred" className={field} placeholder="e.g. CAC applicant" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Start date</span><input name="start" type="date" className={field} /></label>
          <label className="block"><span className={labelCls}>End date</span><input name="end" type="date" className={field} /></label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Add Record"}</Button>
      </form>
    </Collapsible>
  );
}

// ─── Requests ───
function SuccessNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success">{children}</div>;
}

export function NameChangeForm({ currentName }: { currentName: string }) {
  const { run, loading, error, done } = useInsert("name_change_requests");
  if (done) return <SuccessNote>Name change request submitted. Review takes 5–7 business days.</SuccessNote>;
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    await run((uid) => ({
      member_id: uid, current_name: currentName, new_name: g("newname").value.trim(),
      reason: g("reason").value, status: "pending",
    }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block"><span className={labelCls}>Current legal name</span><input className={field} value={currentName} disabled /></label>
      <label className="block"><span className={labelCls}>New legal name *</span><input name="newname" className={field} required /></label>
      <label className="block"><span className={labelCls}>Reason *</span>
        <select name="reason" className={field} defaultValue="" required>
          <option value="" disabled>— Select —</option>
          <option>Marriage</option><option>Divorce</option><option>Court Order</option><option>Other</option>
        </select>
      </label>
      <p className="text-xs text-muted">Upload your supporting document (marriage certificate, court order) on the Documents page.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}</Button>
    </form>
  );
}

export function VerificationForm() {
  const { run, loading, error, done } = useInsert("verification_requests");
  if (done) return <SuccessNote>Verification request submitted successfully.</SuccessNote>;
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    await run((uid) => ({
      member_id: uid, purpose: g("purpose").value.trim(), recipient_name: g("recipient").value.trim(),
      recipient_email: g("email").value.trim() || null, notes: g("notes").value.trim() || null, status: "pending",
    }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block"><span className={labelCls}>Purpose *</span><input name="purpose" className={field} required placeholder="e.g. Employer verification" /></label>
      <label className="block"><span className={labelCls}>Recipient name *</span><input name="recipient" className={field} required /></label>
      <label className="block"><span className={labelCls}>Recipient email</span><input name="email" type="email" className={field} /></label>
      <label className="block"><span className={labelCls}>Notes</span><input name="notes" className={field} /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}</Button>
    </form>
  );
}

export function ReciprocityForm() {
  const { run, loading, error, done } = useInsert("reciprocity_requests");
  if (done) return <SuccessNote>IC&RC reciprocity request submitted. ABCAC will contact you within 5 business days.</SuccessNote>;
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    await run((uid) => ({
      member_id: uid, direction: g("direction").value, credential: g("credential").value.trim() || null,
      destination: g("destination").value.trim() || null, reason: g("reason").value.trim() || null, status: "pending",
    }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block"><span className={labelCls}>Direction *</span>
        <select name="direction" className={field} defaultValue="out_of_az">
          <option value="out_of_az">Transfer out of Arizona</option>
          <option value="into_az">Transfer into Arizona</option>
        </select>
      </label>
      <label className="block"><span className={labelCls}>Credential</span><input name="credential" className={field} placeholder="e.g. CADAC" /></label>
      <label className="block"><span className={labelCls}>Destination / origin board</span><input name="destination" className={field} /></label>
      <label className="block"><span className={labelCls}>Reason</span><input name="reason" className={field} /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}</Button>
    </form>
  );
}
