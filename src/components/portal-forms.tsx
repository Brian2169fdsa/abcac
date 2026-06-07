"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const labelCls = "mb-1.5 block text-sm font-semibold";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];

/** Validate + upload a member file to a private bucket under <uid>/. Returns the stored path. */
async function uploadMemberFile(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  bucket: string,
  uid: string,
  file: File,
): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("File must be under 10MB.");
  if (!ALLOWED_EXT.includes((file.name.split(".").pop() || "").toLowerCase())) {
    throw new Error("Use a PDF, JPG, or PNG.");
  }
  const path = `${uid}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
}

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

// ─── Employment (add + edit; member-writable employment_records) ───
export interface EmploymentRecord {
  id: string;
  employer_name: string | null;
  position_title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
}

// The shared add/edit fieldset. When `record` is present we UPDATE that row in
// place (CRUD edit); otherwise we INSERT a new employment record.
function EmploymentFields({ record, onSaved }: { record?: EmploymentRecord; onSaved?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const current = g("current").checked;
    const payload = {
      employer_name: g("employer").value.trim(),
      position_title: g("position").value.trim(),
      start_date: g("start").value || null,
      end_date: current ? null : g("end").value || null,
      is_current: current,
    };
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }
      const q = record
        ? supabase.from("employment_records").update(payload).eq("id", record.id).eq("member_id", user.id)
        : supabase.from("employment_records").insert({ member_id: user.id, ...payload });
      const { error: err } = await q;
      if (err) throw err;
      if (!record) f.reset();
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3>{record ? "Edit Employment Record" : "Add Employment Record"}</h3>
      <label className="block"><span className={labelCls}>Employer *</span><input name="employer" className={field} required defaultValue={record?.employer_name ?? ""} /></label>
      <label className="block"><span className={labelCls}>Position / Title *</span><input name="position" className={field} required defaultValue={record?.position_title ?? ""} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={labelCls}>Start date</span><input name="start" type="date" className={field} defaultValue={record?.start_date ?? ""} /></label>
        <label className="block"><span className={labelCls}>End date</span><input name="end" type="date" className={field} defaultValue={record?.end_date ?? ""} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input name="current" type="checkbox" className="h-4 w-4" defaultChecked={record?.is_current ?? false} /> Currently employed here</label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : record ? "Save Changes" : "Add Record"}</Button>
    </form>
  );
}

export function AddEmploymentForm() {
  return (
    <Collapsible label="+ Add Employment">
      <EmploymentFields />
    </Collapsible>
  );
}

// Inline edit for an existing employment row (used on the Experience page).
export function EditEmploymentForm({ record }: { record: EmploymentRecord }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Edit</Button>;
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <EmploymentFields record={record} onSaved={() => setOpen(false)} />
    </div>
  );
}

// ─── Other certification (with optional supporting-document upload) ───
export function AddOtherCertForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const file = (f.elements.namedItem("doc") as HTMLInputElement).files?.[0];
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }

      let docPath: string | null = null;
      if (file) docPath = await uploadMemberFile(supabase, "member-documents", user.id, file);

      const { error: insErr } = await supabase.from("other_certifications").insert({
        member_id: user.id,
        credential_title: g("title").value.trim(),
        credential_number: g("number").value.trim() || null,
        issuing_board: g("board").value.trim(),
        issued_date: g("issued").value || null,
        expiration_date: g("expires").value || null,
        doc_path: docPath,
      });
      if (insErr) throw insErr;
      f.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <label className="block"><span className={labelCls}>Supporting document (PDF/JPG/PNG, max 10MB)</span>
          <input name="doc" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Add Certification"}</Button>
      </form>
    </Collapsible>
  );
}

// ─── Clinical supervision (keyed on supervisor_id) ───
//
// Optionally links the supervisee to their ABCAC member profile by email so the
// supervised member can SEE the record and the admin can show it in both
// directions (migration 023). The link is resolved server-side via the
// find_member_id_by_email RPC, which exposes only the matched id (or NULL for
// off-platform supervisees — those still record fine via the free-text name).
export function AddSupervisionForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNote(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const end = g("end").value;
    const supEmail = g("supEmail").value.trim();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }

      // Resolve an ABCAC member id from the supervisee's email, if provided.
      let superviseeMemberId: string | null = null;
      if (supEmail) {
        const { data: matchId } = await supabase.rpc("find_member_id_by_email", { p_email: supEmail });
        superviseeMemberId = (matchId as string | null) ?? null;
        if (!superviseeMemberId) {
          setNote("No ABCAC member found for that email — saved as an off-platform supervisee. They won't see this record in their portal.");
        }
      }

      const { error: insErr } = await supabase.from("supervision_records").insert({
        supervisor_id: user.id,
        supervisee_name: g("name").value.trim(),
        supervisee_credential: g("cred").value.trim() || null,
        supervisee_member_id: superviseeMemberId,
        start_date: g("start").value || null,
        end_date: end || null,
        status: end ? "completed" : "active",
      });
      if (insErr) throw insErr;
      f.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Collapsible label="+ Add Supervision Record">
      <form onSubmit={onSubmit} className="space-y-4">
        <h3>Add Supervision Record</h3>
        <label className="block"><span className={labelCls}>Supervisee name *</span><input name="name" className={field} required /></label>
        <label className="block"><span className={labelCls}>Supervisee credential</span><input name="cred" className={field} placeholder="e.g. CAC applicant" /></label>
        <label className="block">
          <span className={labelCls}>Supervisee ABCAC member email</span>
          <input name="supEmail" type="email" className={field} placeholder="optional — links them so they can see this record" />
          <span className="mt-1 block text-xs text-muted">If your supervisee is an ABCAC member, enter their account email to link the record to them.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Start date</span><input name="start" type="date" className={field} /></label>
          <label className="block"><span className={labelCls}>End date</span><input name="end" type="date" className={field} /></label>
        </div>
        {note && <p className="text-sm text-amber-700">{note}</p>}
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) return <SuccessNote>Name change request submitted. Review takes 5–7 business days.</SuccessNote>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const file = (f.elements.namedItem("doc") as HTMLInputElement).files?.[0];
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }

      let docPath: string | null = null;
      if (file) docPath = await uploadMemberFile(supabase, "name-change-docs", user.id, file);

      const { error: insErr } = await supabase.from("name_change_requests").insert({
        member_id: user.id, current_name: currentName, new_name: g("newname").value.trim(),
        reason: g("reason").value, doc_path: docPath, status: "pending",
      });
      if (insErr) throw insErr;
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
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
      <label className="block"><span className={labelCls}>Supporting ID / document (PDF/JPG/PNG, max 10MB)</span>
        <input name="doc" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        <span className="mt-1 block text-xs text-muted">e.g. marriage certificate, court order, or government photo ID.</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}</Button>
    </form>
  );
}

// A selectable certification. `certId` is set only for ISSUED credentials
// (rows in public.certifications); member-recorded "other" credentials have a
// null certId and are captured by label/notes instead (cert_id FKs certifications).
export interface VerifyCertOption { value: string; label: string; certId: string | null }

export function VerificationForm({ certOptions = [] }: { certOptions?: VerifyCertOption[] }) {
  const { run, loading, error, done } = useInsert("verification_requests");
  if (done) return <SuccessNote>Verification request submitted successfully.</SuccessNote>;
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const sel = (f.elements.namedItem("cert") as HTMLSelectElement)?.value || "";
    const picked = certOptions.find((o) => o.value === sel);
    const notes = g("notes").value.trim();
    // If the member chose an "other" credential (no cert_id), record which one in notes.
    const composedNotes = [picked && !picked.certId ? `Certification: ${picked.label}` : null, notes || null]
      .filter(Boolean).join(" — ") || null;
    await run((uid) => ({
      member_id: uid, purpose: g("purpose").value.trim(), recipient_name: g("recipient").value.trim(),
      recipient_email: g("email").value.trim() || null, notes: composedNotes,
      cert_id: picked?.certId ?? null, status: "pending",
    }));
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block"><span className={labelCls}>Certification to verify{certOptions.length > 0 ? " *" : ""}</span>
        <select name="cert" className={field} defaultValue="" required={certOptions.length > 0} disabled={certOptions.length === 0}>
          <option value="" disabled>{certOptions.length === 0 ? "No certifications on file" : "— Select —"}</option>
          {certOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Purpose *</span><input name="purpose" className={field} required placeholder="e.g. Employer verification" /></label>
      <label className="block"><span className={labelCls}>Recipient name *</span><input name="recipient" className={field} required /></label>
      <label className="block"><span className={labelCls}>Recipient email</span><input name="email" type="email" className={field} /></label>
      <label className="block"><span className={labelCls}>Notes</span><input name="notes" className={field} /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Request"}</Button>
    </form>
  );
}

// IC&RC reciprocity — full OUT-of-Arizona and INTO-Arizona flows.
//
//  • Transfer OUT of Arizona (member-initiated): carries the $150 IC&RC transfer
//    fee. We persist the request first (so admin always sees it even if the
//    member abandons payment), then start a credit-card-only Stripe Checkout via
//    the existing /api/stripe/checkout. We capture the DESTINATION BOARD EMAIL so
//    the admin can notify the receiving board on approval. If online payment is
//    not configured/seeded, the request still persists and the member is told
//    ABCAC will invoice the $150 fee — `npm run build` stays green with no env.
//
//  • Transfer INTO Arizona (inbound notice): no fee. Creates an admin-visible
//    record (origin board + credential) and confirms to the member.
const RECIPROCITY_FEE_CENTS = 15000; // $150 IC&RC transfer fee (OUT only)
const RECIPROCITY_SLUG = "icrc-reciprocity-transfer"; // catalog slug for the $150 fee, if seeded

export function ReciprocityForm() {
  const router = useRouter();
  const [direction, setDirection] = useState<"out_of_az" | "into_az">("out_of_az");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "out_paid" | "out_invoice" | "into">(null);

  if (done === "into")
    return <SuccessNote>Inbound IC&RC reciprocity notice received. ABCAC has your request on file and will contact you within 5 business days. No fee is due for transfers into Arizona.</SuccessNote>;
  if (done === "out_invoice")
    return <SuccessNote>Your outbound IC&RC reciprocity request was submitted. Online payment isn’t available right now — ABCAC will invoice you the $150 transfer fee. We’ll notify the destination board once your transfer is approved.</SuccessNote>;
  if (done === "out_paid")
    return <SuccessNote>Your outbound IC&RC reciprocity request was submitted. Redirecting you to pay the $150 transfer fee…</SuccessNote>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const isOut = direction === "out_of_az";
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }

      const row: Record<string, unknown> = {
        member_id: user.id,
        direction,
        credential: g("credential").value.trim() || null,
        destination: g("destination").value.trim() || null,
        reason: g("reason").value.trim() || null,
        status: "pending",
      };
      if (isOut) {
        row.destination_board_email = g("boardEmail").value.trim() || null;
        row.fee_cents = RECIPROCITY_FEE_CENTS;
        row.payment_status = "unpaid";
      } else {
        row.origin_board = g("destination").value.trim() || null;
        row.origin_board_email = g("boardEmail").value.trim() || null;
        row.fee_cents = 0;
        row.payment_status = "none";
      }

      // Persist FIRST and read back the new row id so we can hand it to Stripe
      // Checkout. The id rides in the session metadata so the webhook can flip
      // payment_status='paid' on success — without it the $150 fee never
      // reconciles (gap #5).
      const { data: inserted, error: insErr } = await supabase
        .from("reciprocity_requests")
        .insert(row)
        .select("id")
        .single();
      if (insErr) throw insErr;

      // INTO Arizona: no fee — confirm and we're done.
      if (!isOut) { setDone("into"); router.refresh(); return; }

      // OUT of Arizona: start the $150 credit-card Stripe Checkout. Degrade
      // gracefully if payments aren't configured/seeded.
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: RECIPROCITY_SLUG, reciprocityRequestId: inserted?.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.url) { setDone("out_paid"); window.location.href = data.url as string; return; }
      } catch { /* fall through to invoice messaging */ }
      // Checkout unavailable — request is saved; ABCAC will invoice the fee.
      setDone("out_invoice");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isOut = direction === "out_of_az";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block"><span className={labelCls}>Direction *</span>
        <select
          name="direction"
          className={field}
          value={direction}
          onChange={(e) => setDirection(e.target.value as "out_of_az" | "into_az")}
        >
          <option value="out_of_az">Transfer OUT of Arizona ($150 fee)</option>
          <option value="into_az">Transfer INTO Arizona (no fee)</option>
        </select>
      </label>
      <label className="block"><span className={labelCls}>Credential</span><input name="credential" className={field} placeholder="e.g. CADAC" /></label>
      <label className="block">
        <span className={labelCls}>{isOut ? "Destination board (where you're transferring TO)" : "Origin board (where you're transferring FROM)"}</span>
        <input name="destination" className={field} placeholder="e.g. Texas Certification Board" />
      </label>
      <label className="block">
        <span className={labelCls}>{isOut ? "Destination board email *" : "Origin board email"}</span>
        <input name="boardEmail" type="email" className={field} required={isOut} placeholder="board contact email" />
        {isOut && <span className="mt-1 block text-xs text-muted">We’ll notify this board once ABCAC approves your transfer.</span>}
      </label>
      <label className="block"><span className={labelCls}>Reason / notes</span><input name="reason" className={field} /></label>
      {isOut
        ? <p className="text-sm text-muted">A <strong>$150 IC&amp;RC transfer fee</strong> applies and is paid by credit card after you submit.</p>
        : <p className="text-sm text-muted">Inbound transfers carry <strong>no fee</strong>. ABCAC will review your notice and follow up.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : isOut ? "Submit & Pay $150" : "Submit Inbound Notice"}
      </Button>
    </form>
  );
}
