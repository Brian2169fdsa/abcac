"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  updateMemberProfile,
  type ProfileFields,
} from "@/app/(admin)/admin/members/[id]/profile-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const label = "flex flex-col gap-1 text-xs font-medium text-muted";

type Feedback = { ok: boolean; text: string } | null;

export type MemberProfileEditProps = {
  memberId: string;
  profile: {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
    ssn_last4?: string | null;
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };
};

/** Form layout: name attr matches the `profiles` column, plus a label + type. */
const FIELDS: ReadonlyArray<{
  name: keyof MemberProfileEditProps["profile"];
  label: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}> = [
  { name: "first_name", label: "First name" },
  { name: "middle_name", label: "Middle name" },
  { name: "last_name", label: "Last name" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "date_of_birth", label: "Date of birth", type: "date" },
  { name: "ssn_last4", label: "SSN (last 4)", maxLength: 4, placeholder: "1234" },
  { name: "address_line1", label: "Address" },
  { name: "city", label: "City" },
  { name: "state", label: "State" },
  { name: "zip_code", label: "ZIP code" },
];

/**
 * Collapsible "Edit personal info" card for the admin member detail page.
 * Pre-fills a form from the passed-in current profile values and saves through
 * the admin-gated `updateMemberProfile` server action (which re-checks admin
 * rights server-side). Shows pending/disabled states and inline success/error.
 */
export function MemberProfileEdit({ memberId, profile }: MemberProfileEditProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const fields: ProfileFields = {};
    for (const f of FIELDS) {
      const el = form.elements.namedItem(f.name) as HTMLInputElement | null;
      fields[f.name] = el ? el.value.trim() : null;
    }
    startTransition(async () => {
      const res = await updateMemberProfile(memberId, fields);
      if (res.ok) {
        setFeedback({ ok: true, text: "Profile saved." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink"
      >
        <span>Edit personal info</span>
        <span className="text-muted" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.name} className={label}>
                {f.label}
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={profile[f.name] ?? ""}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  className={field}
                  disabled={pending}
                />
              </label>
            ))}
          </div>
          {feedback && (
            <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>
              {feedback.text}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
