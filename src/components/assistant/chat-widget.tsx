"use client";

import { useRef, useState } from "react";
import { MessageCircle, X, Loader2, Send } from "lucide-react";

/**
 * Floating conversational-assistant widget. Launcher button bottom-right opens
 * a panel with the conversation + a compact "Actions taken" list. It posts the
 * running message history to /api/assistant with the surface ("member" |
 * "admin"); the server determines the actual toolset from the session role, so
 * the surface prop only requests the admin toolset when on an admin page.
 *
 * Graceful degradation: a 503 { error: "assistant_not_configured" } renders a
 * friendly "AI assistant isn't enabled yet" notice instead of an error.
 */

type Surface = "member" | "admin" | "website";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ActionEntry {
  tool: string;
  ok: boolean;
  summary: string;
}

export function ChatWidget({ surface }: { surface: Surface }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = surface === "admin";
  const isWebsite = surface === "website";
  const accent = isAdmin
    ? "ABCAC Admin Assistant"
    : isWebsite
      ? "ABCAC Website Guide"
      : "ABCAC Assistant";
  const subtitle = isWebsite
    ? "Questions about certification? Ask away"
    : "Ask, and I can take action for you";

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setNotice(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, messages: nextMessages }),
      });

      if (res.status === 503) {
        setNotice("The AI assistant isn't enabled yet. Please check back soon.");
        return;
      }
      if (res.status === 401) {
        setNotice("Your session expired — please sign in again.");
        return;
      }
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(
          data.message ??
            "You're sending messages too quickly. Please wait a moment and try again.",
        );
        return;
      }
      if (res.status === 400) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(data.message ?? "That message couldn't be sent. Please try a shorter one.");
        return;
      }
      if (!res.ok) {
        setNotice("Sorry, something went wrong. Please try again.");
        return;
      }

      const data = (await res.json()) as { reply?: string; actions?: ActionEntry[] };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "(no response)" },
      ]);
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        setActions((prev) => [...prev, ...data.actions!]);
      }
    } catch {
      setNotice("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
      <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{accent}</span>
          <span className="text-[11px] text-white/70">{subtitle}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close assistant"
          className="rounded-md p-1 hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !notice && (
          <p className="text-sm text-muted">
            {isAdmin
              ? "Hi! I can look up members and take admin actions — approvals, CEUs, verifications, invoices, and more. Try “show me pending CEUs.”"
              : isWebsite
                ? "Hi! I'm the ABCAC Website Guide. Ask me about certification paths, fees, exams, IC&RC, reciprocity, CEUs, or how to apply. Try “How do I get certified?”"
                : "Hi! I can help with your certifications, CEUs, renewals, documents, and requests. Try “how many CEU hours do I still need?”"}
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-2 text-sm"
            }
          >
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Thinking…
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-muted">
            {notice}
          </div>
        )}

        {actions.length > 0 && (
          <div className="rounded-lg border border-line bg-surface p-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Actions taken
            </div>
            <ul className="space-y-1">
              {actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span aria-hidden>{a.ok ? "✅" : "⚠️"}</span>
                  <span className="text-muted">
                    <span className="font-medium text-ink">{a.tool}</span> — {a.summary}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Type a message…"
            className="max-h-28 flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !input.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
