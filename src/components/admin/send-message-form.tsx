"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export interface MemberOption { id: string; label: string; }

export function SendMessageForm({ members }: { members: MemberOption[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const f = e.currentTarget;
    const memberId = (f.elements.namedItem("member") as HTMLSelectElement).value;
    const subject = (f.elements.namedItem("subject") as HTMLInputElement).value.trim();
    const body = (f.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
    if (!memberId || !subject) { setMsg("Select a member and enter a subject."); return; }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("messages").insert({ member_id: memberId, from_name: "ABCAC Admin", subject, body, is_read: false });
      if (error) { setMsg("Failed: " + error.message); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "message_sent",
          target_table: "messages",
          target_id: null,
          details: { member_id: memberId },
        });
      } catch { /* best-effort */ }
      f.reset();
      setMsg("Message sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border border-line bg-surface p-6">
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">Member</span>
        <select name="member" className={field} defaultValue="">
          <option value="" disabled>— Select member —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">Subject</span><input name="subject" className={field} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">Message</span>
        <textarea name="body" rows={5} className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
      </label>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button type="submit" disabled={busy}>Send Message</Button>
    </form>
  );
}
