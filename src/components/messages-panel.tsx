"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Message {
  id: string; from_name: string | null; subject: string | null; body: string | null;
  is_read: boolean | null; created_at: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}

export function MessagesPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("messages").select("*").eq("member_id", user.id).order("created_at", { ascending: false });
    setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function open(m: Message) {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.is_read) {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("messages").update({ is_read: true }).eq("id", m.id);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
    }
  }

  if (loading) return <p className="text-muted">Loading messages…</p>;
  if (messages.length === 0) return <p className="text-muted">No messages yet.</p>;

  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
      {messages.map((m) => (
        <div key={m.id} className="p-4">
          <button onClick={() => open(m)} className="flex w-full items-center gap-3 text-left">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${m.is_read ? "bg-line" : "bg-brand"}`} aria-hidden />
            <span className="flex-1">
              <span className={`block ${m.is_read ? "" : "font-semibold"}`}>{m.subject ?? "—"}</span>
              <span className="block text-xs text-muted">{m.from_name ?? "ABCAC Admin"} · {fmt(m.created_at)}</span>
            </span>
          </button>
          {openId === m.id && m.body && <p className="mt-3 whitespace-pre-wrap pl-5 text-sm text-muted">{m.body}</p>}
        </div>
      ))}
    </div>
  );
}
