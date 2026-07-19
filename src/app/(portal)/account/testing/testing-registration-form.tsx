"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ACCOMMODATION_OPTIONS, CREDENTIAL_OPTIONS, EXAM_OPTIONS, type TestingMode } from "@/lib/testing-requests";
import { attachTestingDocuments, createTestingRequest, type TestingRequestInput } from "./actions";

type ProfileDefaults = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
};

const field = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";
const textarea = `${field} h-24 py-3`;

export function TestingRegistrationForm({ defaults, initialMode }: { defaults: ProfileDefaults; initialMode: TestingMode }) {
  const [mode, setMode] = useState<TestingMode>(initialMode);
  const [payingForOther, setPayingForOther] = useState(false);
  const [seeksCredential, setSeeksCredential] = useState(false);
  const [accommodations, setAccommodations] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    const input: TestingRequestInput = {
      purchaserFirstName: value("purchaserFirstName"), purchaserLastName: value("purchaserLastName"), purchaserEmail: value("purchaserEmail"),
      purchaserPhone: value("purchaserPhone"), purchaserAddress: value("purchaserAddress"), purchaserDateOfBirth: value("purchaserDateOfBirth"),
      examCode: value("examCode"), testingMode: mode, testingLocation: value("testingLocation"), seeksAbcacCredential: seeksCredential,
      credentialLevel: value("credentialLevel"), azbbheApproved: value("azbbheApproved") === "yes", payingForOther,
      testerFirstName: value("testerFirstName"), testerLastName: value("testerLastName"), testerEmail: value("testerEmail"),
      testerAddress: value("testerAddress"), testerDateOfBirth: value("testerDateOfBirth"), accommodationsRequested: accommodations,
      accommodationsDetail: data.getAll("accommodationsDetail").map(String),
    };
    const result = await createTestingRequest(input);
    if (!result.ok) { setError(result.error); setLoading(false); return; }
    try {
      const supportingFiles = data.getAll("supportingDocuments").filter((item): item is File => item instanceof File && item.size > 0);
      if (supportingFiles.length > 10) throw new Error("Upload no more than 10 supporting files.");
      if (supportingFiles.some((file) => file.size > 10 * 1024 * 1024)) throw new Error("Each supporting file must be under 10MB.");
      if (supportingFiles.length) {
        const supabase = createSupabaseBrowserClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Your session expired. Sign in and resume payment from Exam Registration.");
        const uploaded: { name: string; path: string }[] = [];
        for (const file of supportingFiles) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `${auth.user.id}/testing/${result.id}/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from("member-documents").upload(path, file);
          if (uploadError) throw uploadError;
          uploaded.push({ name: file.name, path });
        }
        const attached = await attachTestingDocuments(result.id, uploaded);
        if (!attached.ok) throw new Error(attached.error ?? "Could not attach supporting documents.");
      }
      const response = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testingRequestId: result.id }),
      });
      const checkout = await response.json();
      if (!response.ok || !checkout.url) throw new Error(checkout.error ?? "checkout_failed");
      window.location.href = checkout.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? `${checkoutError.message} Your request was saved; you can resume from Exam Registration.` : "Your request was saved, but payment could not start. Open Exam Registration from your portal to try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-2xl">Your information</h2><p className="mt-1 text-sm text-muted">Use the legal information that matches your government-issued identification.</p></div></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold">First name<input required name="purchaserFirstName" defaultValue={defaults.firstName} className={`mt-2 ${field}`} /></label>
          <label className="text-sm font-semibold">Last name<input required name="purchaserLastName" defaultValue={defaults.lastName} className={`mt-2 ${field}`} /></label>
          <label className="text-sm font-semibold">Email<input required type="email" name="purchaserEmail" defaultValue={defaults.email} className={`mt-2 ${field}`} /></label>
          <label className="text-sm font-semibold">Phone<input required type="tel" name="purchaserPhone" defaultValue={defaults.phone} className={`mt-2 ${field}`} /></label>
          <label className="text-sm font-semibold">Date of birth<input required type="date" name="purchaserDateOfBirth" defaultValue={defaults.dateOfBirth} className={`mt-2 ${field}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">Address matching your ID<textarea required name="purchaserAddress" defaultValue={defaults.address} className={`mt-2 ${textarea}`} /></label>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl">Exam selection</h2><p className="mt-1 text-sm text-muted">ABCAC uses this information to pre-register the tester with SMT.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">IC&amp;RC exam<select required name="examCode" className={`mt-2 ${field}`}><option value="">Select an exam</option>{EXAM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm font-semibold">AZBBHE authorization<select required name="azbbheApproved" className={`mt-2 ${field}`}><option value="">Select one</option><option value="yes">Yes, AZBBHE approved me to test</option><option value="no">No / testing for ABCAC certification</option></select></label>
        </div>
        <fieldset className="mt-6"><legend className="text-sm font-semibold">Testing mode</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{([['in_person','In-person exam · $225'],['remote','Remote-proctored exam · $275']] as const).map(([value,label]) => <label key={value} className={`cursor-pointer rounded-2xl border p-4 transition ${mode === value ? 'border-brand bg-brand/[0.05]' : 'border-line'}`}><input type="radio" className="mr-2 accent-brand" checked={mode === value} onChange={() => setMode(value)} /> <span className="font-semibold">{label}</span></label>)}</div></fieldset>
        {mode === "in_person" && <label className="mt-5 block text-sm font-semibold">Preferred testing city or area<input required name="testingLocation" placeholder="Phoenix, Flagstaff, or another preferred area" className={`mt-2 ${field}`} /></label>}
        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4"><input type="checkbox" className="mt-1 accent-brand" checked={seeksCredential} onChange={(event) => setSeeksCredential(event.target.checked)} /><span><strong>Also apply for an ABCAC professional credential</strong><span className="mt-1 block text-sm text-muted">Adds the $150 certification-only processing fee to checkout. Certification approval remains subject to all requirements.</span></span></label>
        {seeksCredential && <label className="mt-4 block text-sm font-semibold">Credential sought<select required name="credentialLevel" className={`mt-2 ${field}`}><option value="">Select a credential</option>{CREDENTIAL_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>}
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl">Tester and accommodations</h2>
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4"><input type="checkbox" className="mt-1 accent-brand" checked={payingForOther} onChange={(event) => setPayingForOther(event.target.checked)} /><span><strong>I am paying for someone else</strong><span className="mt-1 block text-sm text-muted">Enter the tester’s information exactly as it appears on their ID.</span></span></label>
        {payingForOther && <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Tester first name<input required name="testerFirstName" className={`mt-2 ${field}`} /></label><label className="text-sm font-semibold">Tester last name<input required name="testerLastName" className={`mt-2 ${field}`} /></label><label className="text-sm font-semibold">Tester email<input required type="email" name="testerEmail" className={`mt-2 ${field}`} /></label><label className="text-sm font-semibold">Tester date of birth<input required type="date" name="testerDateOfBirth" className={`mt-2 ${field}`} /></label><label className="text-sm font-semibold sm:col-span-2">Tester address<textarea required name="testerAddress" className={`mt-2 ${textarea}`} /></label></div>}
        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-bg p-4"><input type="checkbox" className="mt-1 accent-brand" checked={accommodations} onChange={(event) => setAccommodations(event.target.checked)} /><span><strong>Special testing accommodations are requested</strong><span className="mt-1 block text-sm text-muted">The accommodations packet and supporting documentation must be submitted before ABCAC completes pre-registration.</span></span></label>
        {accommodations && <fieldset className="mt-4 rounded-2xl border border-line bg-bg p-4"><legend className="px-1 text-sm font-semibold">Select the accommodations you need <span className="font-normal text-muted">(approved in advance)</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ACCOMMODATION_OPTIONS.map((option) => <label key={option} className="flex items-start gap-2 text-sm"><input type="checkbox" name="accommodationsDetail" value={option} className="mt-0.5 accent-brand" /> {option}</label>)}</div></fieldset>}
        {accommodations && <div className="mt-4 flex flex-wrap gap-3"><Link href="/account/forms?workflow=testing%3Aaccommodations" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Complete digitally <ArrowRight className="h-4 w-4" /></Link><a href="/forms/library/testing-special-accommodations.pdf" download className="inline-flex items-center rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand">Download paper form</a></div>}
        <label className="mt-6 block text-sm font-semibold">Supporting documents <span className="font-normal text-muted">(optional)</span><input type="file" name="supportingDocuments" multiple accept=".pdf,.jpg,.jpeg,.png" className="mt-2 block w-full rounded-xl border border-dashed border-line bg-bg p-4 text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-muted">Upload up to 10 PDF, JPG, or PNG files. Each file must be under 10MB.</span></label>
      </section>

      <div className="rounded-3xl bg-info p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8"><div><h2 className="text-2xl text-white">Submit and pay securely</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">Your request is saved before Stripe checkout. Payment moves it into the ABCAC staff queue for SMT pre-registration.</p>{error && <p className="mt-3 font-semibold text-red-200">{error}</p>}</div><Button type="submit" disabled={loading} size="lg" className="mt-5 w-full shrink-0 bg-white text-info hover:bg-white/90 sm:mt-0 sm:w-auto">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Save &amp; Continue to Payment <CheckCircle2 className="h-4 w-4" /></>}</Button></div>
    </form>
  );
}
