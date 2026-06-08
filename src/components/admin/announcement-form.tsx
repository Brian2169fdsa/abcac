"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const AUDIENCES = [
  {
    value: "abcac_announcements",
    label: "ABCAC announcements",
    help: "Members who opted in to general ABCAC announcements.",
  },
  {
    value: "icrc_updates",
    label: "IC&RC updates",
    help: "Members who opted in to IC&RC reciprocity & credentialing updates.",
  },
] as const;

export function AnnouncementForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const f = e.currentTarget;
    const audience = (f.elements.namedItem("audience") as HTMLSelectElement).value;
    const subject = (f.elements.namedItem("subject") as HTMLInputElement).value.trim();
    const body = (f.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
    if (!audience || !subject || !body) {
      setErr("Pick an audience and enter a subject and message.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          data?.error === "forbidden" || data?.error === "unauthorized"
            ? "You're not signed in as an admin."
            : "Could not send the announcement. Please try again.",
        );
        return;
      }
      f.reset();
      const emailedNote =
        typeof data.emailed === "number" && data.emailed > 0 ? ` ${data.emailed} emailed.` : "";
      setMsg(
        data.recipients === 0
          ? "No members are opted in to that audience yet — nothing was sent."
          : `Announcement delivered to ${data.recipients} member${data.recipients === 1 ? "" : "s"}' inbox.${emailedNote}`,
      );
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border border-line bg-surface p-6">
      {msg && (
        <div className="rounded-lg border border-success/40 bg-success/5 px-4 py-2 text-sm text-success">{msg}</div>
      )}
      {err && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Audience</span>
        <select name="audience" className={field} defaultValue="">
          <option value="" disabled>
            — Select audience —
          </option>
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-muted">
          Sends only to members who have opted in to this channel in their account settings.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Subject</span>
        <input name="subject" className={field} maxLength={200} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">Message</span>
        <textarea
          name="body"
          rows={7}
          className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
      </label>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Send Announcement"}
      </Button>
    </form>
  );
}
