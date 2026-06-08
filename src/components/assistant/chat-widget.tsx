"use client";

import { useRef, useState } from "react";
import { MessageCircle, X, Loader2, Send, Sparkles } from "lucide-react";
import { Markdown } from "@/components/assistant/markdown";

/**
 * Floating conversational-assistant widget. The launcher (bottom-right) opens a
 * rich panel: markdown-rendered replies (tables, headings, lists), inline
 * tool-call chips for actions the assistant took, contextual suggested prompts,
 * and a polished composer. It posts the running message history to
 * /api/assistant with the surface ("member" | "admin" | "website"); the server
 * decides the real toolset from the session role.
 *
 * Graceful degradation: 503 { error: "assistant_not_configured" } renders a
 * friendly "not enabled yet" notice instead of an error.
 */

type Surface = "member" | "admin" | "website";

interface ActionEntry {
  tool: string;
  ok: boolean;
  summary: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ActionEntry[];
}

const SUGGESTIONS: Record<Surface, string[]> = {
  website: [
    "How do I get certified as an addiction counselor?",
    "How do I register for the IC&RC exam?",
    "What are the CEU renewal requirements?",
    "How much does certification cost?",
    "Transfer my credential to Arizona (reciprocity)",
  ],
  member: [
    "How many CEU hours do I still need?",
    "When does my certification expire?",
    "What documents do I still need to upload?",
    "How do I register for my IC&RC exam?",
    "What's my next step to get certified?",
  ],
  admin: [
    "Show me pending CEU submissions",
    "Who's awaiting account approval?",
    "Which credentials expire in the next 60 days?",
    "Summarize a member's certification status",
    "Draft a renewal reminder for a member",
  ],
};

const PLACEHOLDER: Record<Surface, string> = {
  website: "Ask about certification, exams, CEUs, fees…",
  member: "Ask about your certs, CEUs, renewals, documents…",
  admin: "Ask about members, approvals, CEUs, invoices…",
};

const FOOTER_NOTE: Record<Surface, string> = {
  website: "General info · no account data",
  member: "Secure · your data only",
  admin: "Read-only context · actions audited",
};

export function ChatWidget({ surface }: { surface: Surface }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = surface === "admin";
  const isWebsite = surface === "website";
  const title = isAdmin ? "ABCAC Admin Assistant" : isWebsite ? "ABCAC Website Guide" : "ABCAC Assistant";
  const subtitle = isWebsite ? "Questions about certification? Ask away." : "Ask, and I can take action for you.";
  const greeting = isAdmin
    ? "Hi! I can look up members and take admin actions — approvals, CEUs, verifications, invoices — and help you plan. Try a prompt below."
    : isWebsite
      ? "Hi! I'm the ABCAC Website Guide. Ask me about certification paths, fees, exams, IC&RC, reciprocity, or CEUs."
      : "Hi! I can help with your certifications, CEUs, renewals, documents, and requests — and guide your next step.";

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setNotice(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
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
        setNotice(data.message ?? "You're sending messages too quickly. Please wait a moment and try again.");
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
        { role: "assistant", content: data.reply ?? "(no response)", actions: data.actions ?? [] },
      ]);
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
      sendText(input);
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

  const suggestions = SUGGESTIONS[surface];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[40rem] max-h-[calc(100vh-2.5rem)] w-[28rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{title}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/75">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
              {subtitle}
            </span>
          </div>
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

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3 text-sm text-ink/90">
              {greeting}
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Try asking</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendText(s)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink transition-colors hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-auto max-w-[92%] space-y-2">
              {m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted"
                      title={a.summary}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${a.ok ? "bg-success" : "bg-amber-500"}`}
                        aria-hidden
                      />
                      {a.tool}
                    </span>
                  ))}
                </div>
              )}
              <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Thinking…
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-muted">{notice}</div>
        )}
      </div>

      {/* Persistent suggestion chips (once the conversation has started) */}
      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-line px-3 py-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendText(s)}
              disabled={busy}
              className="whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-line bg-surface p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={PLACEHOLDER[surface]}
            className="max-h-28 flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="button"
            onClick={() => sendText(input)}
            disabled={busy || !input.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-0.5 text-[10px] text-muted">
          <span className="font-medium">
            Powered by <span className="font-semibold text-ink">Manage AI</span>
          </span>
          <span>{FOOTER_NOTE[surface]}</span>
        </div>
      </div>
    </div>
  );
}
