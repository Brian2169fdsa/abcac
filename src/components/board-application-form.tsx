"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "ok" | "error";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const area =
  "w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const label = "mb-1.5 block text-sm font-semibold";

const CERTIFICATIONS = ["CADAC", "CCJP", "AADC", "CCS", "CPS", "CPRS"] as const;

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <legend className="px-2 font-display text-lg font-semibold text-ink">{title}</legend>
      <div className="mt-2 space-y-4">{children}</div>
    </fieldset>
  );
}

async function fileToBase64(file: File): Promise<{ filename: string; content: string }> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { filename: file.name, content: btoa(binary) };
}

export function BoardApplicationForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const get = (name: string) => (data.get(name)?.toString() ?? "").trim();
    const certifications = data.getAll("certifications").map((c) => c.toString());

    const resumeFile = data.get("resume");
    const referencesFile = data.get("references");

    if (!get("fullName") || !get("email") || !get("phone") || !get("whyJoin") || !get("acknowledge")) {
      setStatus("error");
      setErrorMsg("Please complete all required fields and confirm the acknowledgment.");
      return;
    }
    if (!(resumeFile instanceof File) || resumeFile.size === 0) {
      setStatus("error");
      setErrorMsg("Please attach your resume or CV.");
      return;
    }
    if (resumeFile.size > 8 * 1024 * 1024) {
      setStatus("error");
      setErrorMsg("Your resume is larger than 8 MB. Please attach a smaller file.");
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const attachments: { filename: string; content: string }[] = [];
      attachments.push(await fileToBase64(resumeFile));
      if (referencesFile instanceof File && referencesFile.size > 0 && referencesFile.size <= 8 * 1024 * 1024) {
        attachments.push(await fileToBase64(referencesFile));
      }

      const payload = {
        fullName: get("fullName"),
        preferredName: get("preferredName"),
        email: get("email"),
        phone: get("phone"),
        mailingAddress: get("mailingAddress"),
        jobTitle: get("jobTitle"),
        organization: get("organization"),
        yearsInField: get("yearsInField"),
        certifications,
        certificationOther: get("certificationOther"),
        whyJoin: get("whyJoin"),
        strengths: get("strengths"),
        experience: get("experience"),
        quarterlyMeetings: get("quarterlyMeetings"),
        quarterlyExplain: get("quarterlyExplain"),
        committees: get("committees"),
        committeesExplain: get("committeesExplain"),
        attachments,
      };

      const res = await fetch("/api/board-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMsg("There was a problem submitting your application. Please try again.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-6 text-success">
        <p className="font-semibold">Thank you for applying to the ABCAC Board of Directors.</p>
        <p className="mt-1 text-sm">
          Your application has been received. Submitting this application does not guarantee selection — board
          membership is subject to board review and approval. We will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Fieldset title="Applicant Information">
        <div>
          <label htmlFor="fullName" className={label}>Full Name *</label>
          <input id="fullName" name="fullName" className={field} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="preferredName" className={label}>Preferred Name (if different)</label>
            <input id="preferredName" name="preferredName" className={field} />
          </div>
          <div>
            <label htmlFor="email" className={label}>Email Address *</label>
            <input id="email" name="email" type="email" className={field} required />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={label}>Phone Number *</label>
            <input id="phone" name="phone" type="tel" className={field} required />
          </div>
          <div>
            <label htmlFor="mailingAddress" className={label}>Mailing Address</label>
            <input id="mailingAddress" name="mailingAddress" className={field} />
          </div>
        </div>
      </Fieldset>

      <Fieldset title="Professional Background">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="jobTitle" className={label}>Current Job Title</label>
            <input id="jobTitle" name="jobTitle" className={field} />
          </div>
          <div>
            <label htmlFor="organization" className={label}>Organization / Employer</label>
            <input id="organization" name="organization" className={field} />
          </div>
        </div>
        <div>
          <label htmlFor="yearsInField" className={label}>Years in the Behavioral Health / Addiction Counseling Field</label>
          <input id="yearsInField" name="yearsInField" className={field} />
        </div>
      </Fieldset>

      <Fieldset title="Certifications (check all that apply)">
        <div className="grid gap-1 sm:grid-cols-3">
          {CERTIFICATIONS.map((c) => (
            <label key={c} className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" name="certifications" value={c} className="h-5 w-5 accent-brand" />
              {c}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="certificationOther" className={label}>Other (please specify)</label>
          <input id="certificationOther" name="certificationOther" className={field} />
        </div>
      </Fieldset>

      <Fieldset title="Application Questions">
        <div>
          <label htmlFor="whyJoin" className={label}>Why do you want to join the ABCAC Board? *</label>
          <textarea id="whyJoin" name="whyJoin" rows={4} className={area} required
            placeholder="Please provide a brief statement explaining your motivation." />
        </div>
        <div>
          <label htmlFor="strengths" className={label}>What strengths, skills, or expertise would you bring to the Board?</label>
          <textarea id="strengths" name="strengths" rows={4} className={area} />
        </div>
        <div>
          <label htmlFor="experience" className={label}>
            What is your experience with professional certification, credentialing, or ethics in the behavioral
            health field?
          </label>
          <textarea id="experience" name="experience" rows={4} className={area} />
        </div>
      </Fieldset>

      <Fieldset title="Availability">
        <div>
          <p className={label}>Are you available to attend quarterly board meetings (in person or virtually)?</p>
          <div className="flex gap-6 text-sm">
            <label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="quarterlyMeetings" value="Yes" className="h-5 w-5 accent-brand" defaultChecked /> Yes</label>
            <label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="quarterlyMeetings" value="No" className="h-5 w-5 accent-brand" /> No</label>
          </div>
          <input name="quarterlyExplain" className={`${field} mt-2`} placeholder="If no, please explain" />
        </div>
        <div>
          <p className={label}>Are you willing to participate in board committees or special projects as needed?</p>
          <div className="flex gap-6 text-sm">
            <label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="committees" value="Yes" className="h-5 w-5 accent-brand" defaultChecked /> Yes</label>
            <label className="flex min-h-[44px] items-center gap-2"><input type="radio" name="committees" value="No" className="h-5 w-5 accent-brand" /> No</label>
          </div>
          <input name="committeesExplain" className={`${field} mt-2`} placeholder="If no, please explain" />
        </div>
      </Fieldset>

      <Fieldset title="Supporting Documents">
        <div>
          <label htmlFor="resume" className={label}>Resume or CV * (PDF or Word, up to 8 MB)</label>
          <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-600" required />
        </div>
        <div>
          <label htmlFor="references" className={label}>Letters of reference or supporting materials (optional)</label>
          <input id="references" name="references" type="file" accept=".pdf,.doc,.docx" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-line file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:brightness-95" />
        </div>
      </Fieldset>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
        <input type="checkbox" name="acknowledge" value="yes" className="mt-0.5 h-5 w-5 shrink-0 accent-brand" required />
        <span>
          I confirm that the information provided in this application is accurate and complete. I understand that
          submitting this application does not guarantee selection and that board membership is subject to board
          review and approval. *
        </span>
      </label>

      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}

      <Button type="submit" disabled={status === "sending"} size="lg" className="w-full sm:w-auto">
        {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit Application"}
      </Button>
    </form>
  );
}
