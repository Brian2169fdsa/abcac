"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export interface AdminMessage {
  id: string;
  member_id: string;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  is_read: boolean | null;
  created_at: string | null;
  sender_role: string | null;
}

export interface ThreadMember {
  id: string;
  name: string;
  email: string | null;
}

interface Thread {
  member: ThreadMember;
  messages: AdminMessage[];
  unread: number; // member-authored messages not yet read by admin
  lastAt: string | null;
}

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function fmt(d: string | null) {
  return d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}

export function AdminMessaging({
  initialMessages,
  members,
}: {
  initialMessages: AdminMessage[];
  members: ThreadMember[];
}) {
  const [messages, setMessages] = useState<AdminMessage[]>(initialMessages);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, ThreadMember>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const threads = useMemo<Thread[]>(() => {
    const byMember = new Map<string, AdminMessage[]>();
    for (const msg of messages) {
      const arr = byMember.get(msg.member_id) ?? [];
      arr.push(msg);
      byMember.set(msg.member_id, arr);
    }
    const list: Thread[] = [];
    Array.from(byMember.entries()).forEach(([memberId, msgs]) => {
      msgs.sort((a: AdminMessage, b: AdminMessage) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      );
      const member =
        memberMap.get(memberId) ?? { id: memberId, name: "Unknown member", email: null };
      const unread = msgs.filter((m: AdminMessage) => m.sender_role === "member" && !m.is_read).length;
      list.push({ member, messages: msgs, unread, lastAt: msgs[msgs.length - 1]?.created_at ?? null });
    });
    list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    return list;
  }, [messages, memberMap]);

  const markThreadRead = useCallback(async (memberId: string) => {
    const unreadIds = messages
      .filter((m) => m.member_id === memberId && m.sender_role === "member" && !m.is_read)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
    setMessages((prev) =>
      prev.map((m) => (unreadIds.includes(m.id) ? { ...m, is_read: true } : m)),
    );
  }, [messages]);

  async function openThread(memberId: string) {
    if (openId === memberId) {
      setOpenId(null);
      return;
    }
    setOpenId(memberId);
    setError(null);
    setNotice(null);
    await markThreadRead(memberId);
  }

  async function reply(e: React.FormEvent<HTMLFormElement>, memberId: string) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const f = e.currentTarget;
    const subject = (f.elements.namedItem("subject") as HTMLInputElement).value.trim();
    const body = (f.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
    if (!subject) {
      setError("Enter a subject.");
      return;
    }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: insErr } = await supabase
        .from("messages")
        .insert({
          member_id: memberId,
          from_name: "ABCAC Admin",
          subject,
          body: body || null,
          sender_role: "admin",
          is_read: false,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;
      if (data) setMessages((prev) => [...prev, data as AdminMessage]);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: "message_sent",
          target_table: "messages",
          target_id: (data as AdminMessage)?.id ?? null,
          details: { member_id: memberId },
        });
      } catch {
        /* best-effort */
      }
      f.reset();
      setNotice("Reply sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  if (threads.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-muted">
        No message threads yet. Use “Compose new message” above to start one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-success">{notice}</p>}
      <div className="divide-y divide-line rounded-xl border border-line bg-surface">
        {threads.map((t) => {
          const open = openId === t.member.id;
          return (
            <div key={t.member.id} className="p-4">
              <button
                onClick={() => openThread(t.member.id)}
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={open}
              >
                <span
                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${t.unread > 0 ? "bg-brand" : "bg-line"}`}
                  aria-hidden
                />
                <span className="flex-1">
                  <span className={`block ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                    {t.member.name}
                    {t.unread > 0 && (
                      <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                        {t.unread} new
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted">
                    {t.member.email ?? "—"} · {t.messages.length} message
                    {t.messages.length === 1 ? "" : "s"} · {fmt(t.lastAt)}
                  </span>
                </span>
                <span className="text-xs text-muted">{open ? "Close" : "Open"}</span>
              </button>

              {open && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    {t.messages.map((m) => {
                      const fromMember = m.sender_role === "member";
                      return (
                        <div
                          key={m.id}
                          className={`rounded-lg border p-3 text-sm ${
                            fromMember
                              ? "border-line bg-bg"
                              : "border-brand/30 bg-brand/5"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between text-xs text-muted">
                            <span className="font-semibold text-ink">
                              {fromMember ? t.member.name : m.from_name ?? "ABCAC Admin"}
                            </span>
                            <span>{fmt(m.created_at)}</span>
                          </div>
                          {m.subject && <div className="font-medium">{m.subject}</div>}
                          {m.body && <p className="mt-1 whitespace-pre-wrap text-muted">{m.body}</p>}
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={(e) => reply(e, t.member.id)}
                    className="space-y-3 rounded-lg border border-line bg-bg p-3"
                  >
                    <div className="text-sm font-semibold">Reply to {t.member.name}</div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">Subject</span>
                      <input
                        name="subject"
                        className={field}
                        defaultValue={
                          t.messages[t.messages.length - 1]?.subject
                            ? `Re: ${t.messages[t.messages.length - 1].subject}`
                            : ""
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">Message</span>
                      <textarea
                        name="body"
                        rows={3}
                        className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      />
                    </label>
                    <Button type="submit" disabled={sending}>
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Send Reply"}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
