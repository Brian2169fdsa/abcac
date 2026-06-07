"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Message {
  id: string; from_name: string | null; subject: string | null; body: string | null;
  is_read: boolean | null; created_at: string | null; sender_role: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function MessagesPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("messages").select("*").eq("member_id", user.id).order("created_at", { ascending: true });
    const rows = (data as Message[]) ?? [];
    setMessages(rows);
    setLoading(false);
    // Mark-as-read on view: flip every unread admin-authored message to read.
    // (Members' own messages don't carry a member-facing read receipt.)
    const unreadIds = rows.filter((m) => !m.is_read && m.sender_role !== "member").map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
      setMessages((prev) => prev.map((x) => (unreadIds.includes(x.id) ? { ...x, is_read: true } : x)));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(m: Message) {
    setOpenId(openId === m.id ? null : m.id);
  }

  async function onSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSent(false);
    const f = e.currentTarget;
    const subject = (f.elements.namedItem("subject") as HTMLInputElement).value.trim();
    const body = (f.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
    if (!subject) { setError("Enter a subject."); return; }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — sign in again."); return; }
      // member_id / sender_role / from_name are pinned server-side by the
      // guard_message_insert trigger; we send our best values for clarity.
      const { error: insErr } = await supabase.from("messages").insert({
        member_id: user.id, subject, body: body || null, sender_role: "member", from_name: "Member", is_read: false,
      });
      if (insErr) throw insErr;
      f.reset();
      setSent(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSend} className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <h3 className="font-semibold">Send a message to ABCAC</h3>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Subject *</span><input name="subject" className={field} required /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Message</span>
          <textarea name="body" rows={4} className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && <p className="text-sm text-success">Message sent to ABCAC.</p>}
        <Button type="submit" disabled={sending}>{sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Send Message"}</Button>
      </form>

      {loading ? (
        <p className="text-muted">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="text-muted">No messages yet.</p>
      ) : (
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {messages.map((m) => {
            const mine = m.sender_role === "member";
            const unread = !m.is_read && !mine;
            return (
              <div key={m.id} className="p-4">
                <button onClick={() => open(m)} className="flex w-full items-center gap-3 text-left">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${unread ? "bg-brand" : "bg-line"}`} aria-hidden />
                  <span className="flex-1">
                    <span className={`block ${unread ? "font-semibold" : ""}`}>{m.subject ?? "—"}</span>
                    <span className="block text-xs text-muted">
                      {mine ? "You → ABCAC" : (m.from_name ?? "ABCAC Admin")} · {fmt(m.created_at)}
                    </span>
                  </span>
                </button>
                {openId === m.id && m.body && <p className="mt-3 whitespace-pre-wrap pl-5 text-sm text-muted">{m.body}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
