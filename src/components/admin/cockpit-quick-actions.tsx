"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendMemberMessage, requestMemberDocument } from "@/app/(admin)/admin/members/[id]/cockpit-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const area =
  "w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Feedback = { ok: boolean; text: string } | null;

/**
 * Compact action bar for the member cockpit. Wires the message + document
 * request server actions (which re-check admin rights server-side) with small
 * inline forms and pending/disabled states. Replaces the old ClickUp hop.
 */
export function CockpitQuickActions({ memberId }: { memberId: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MessageCard memberId={memberId} />
      <DocumentCard memberId={memberId} />
    </div>
  );
}

function MessageCard({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const subject = (form.elements.namedItem("subject") as HTMLInputElement).value.trim();
    const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
    if (!subject) {
      setFeedback({ ok: false, text: "Enter a subject." });
      return;
    }
    startTransition(async () => {
      const res = await sendMemberMessage(memberId, subject, body);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Message sent." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="text-sm font-semibold text-ink">Message this member</div>
      <input name="subject" placeholder="Subject" className={field} disabled={pending} />
      <textarea name="body" rows={3} placeholder="Message (optional)" className={area} disabled={pending} />
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function DocumentCard({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const documentType = (form.elements.namedItem("document_type") as HTMLInputElement).value.trim();
    const note = (form.elements.namedItem("note") as HTMLInputElement).value.trim();
    if (!documentType) {
      setFeedback({ ok: false, text: "Enter a document type." });
      return;
    }
    startTransition(async () => {
      const res = await requestMemberDocument(memberId, documentType, note);
      if (res.ok) {
        form.reset();
        setFeedback({ ok: true, text: "Document requested." });
      } else {
        setFeedback({ ok: false, text: "Failed: " + res.error });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="text-sm font-semibold text-ink">Request a document</div>
      <input
        name="document_type"
        placeholder="e.g. Updated transcript"
        className={field}
        disabled={pending}
      />
      <input name="note" placeholder="Note (optional)" className={field} disabled={pending} />
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Requesting…" : "Request document"}
      </Button>
    </form>
  );
}
