"use client";

import { useRef, useState } from "react";
import { MessageCircle, X, Loader2, Send, Sparkles, Paperclip, Mail } from "lucide-react";
import { Markdown } from "@/components/assistant/markdown";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Floating conversational-assistant widget. The launcher (bottom-right) opens a
 * rich panel: markdown-rendered replies (tables, headings, lists), inline
 * tool-call chips for actions the assistant took, contextual suggested prompts,
 * and a polished composer. It posts the running message history to
 * /api/assistant with the surface ("member" | "admin" | "website").
 *
 * Work-partner extras:
 *  - member surface: attach a file → uploads to the member's documents.
 *  - website surface: "Email me this conversation" → sends the Q&A transcript.
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
    "Build my plan to get certified",
    "Update my phone number",
    "What documents do I still need to upload?",
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
  member: "Ask, plan, update info, or attach a document…",
  admin: "Ask about members, approvals, CEUs, invoices…",
};

const FOOTER_NOTE: Record<Surface, string> = {
  website: "General info · no account data",
  member: "Secure · your data only",
  admin: "Read-only context · actions audited",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];

export function ChatWidget({ surface }: { surface: Surface }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = surface === "admin";
  const isWebsite = surface === "website";
  const isMember = surface === "member";
  const title = isAdmin ? "ABCAC Admin Assistant" : isWebsite ? "ABCAC Website Guide" : "ABCAC Assistant";
  const subtitle = isWebsite ? "Questions about certification? Ask away." : "Ask, and I can take action for you.";
  const greeting = isAdmin
    ? "Hi! I can look up members and take admin actions — approvals, CEUs, verifications, invoices — and help you plan. Try a prompt below."
    : isWebsite
      ? "Hi! I'm the ABCAC Website Guide. Ask me about certification paths, fees, exams, IC&RC, reciprocity, or CEUs."
      : "Hi! I can answer questions, build your plan to certification, update your info, and even file a document for you. What would you like to do?";

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

  /** Member surface: upload a document straight from the chat. */
  async function uploadFile(file: File) {
    setNotice(null);
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice("That file is over 10MB — please attach a smaller one.");
      return;
    }
    if (!ALLOWED_EXT.includes(ext)) {
      setNotice("Please attach a PDF, JPG, or PNG.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotice("Your session expired — please sign in again.");
        return;
      }
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("member-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        member_id: user.id,
        document_type: "Uploaded via assistant",
        file_name: file.name,
        file_path: path,
        file_size_kb: Math.round(file.size / 1024),
        status: "pending",
      });
      if (insErr) throw insErr;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📎 Attached a document: ${file.name}` },
        {
          role: "assistant",
          content: `Got it — I've filed **${file.name}** to your documents. It's marked *pending* for our team to review. You can ask me about your documents anytime.`,
        },
      ]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      scrollToBottom();
    }
  }

  /** Website surface: email the conversation transcript to the visitor. */
  async function exportTranscript() {
    const email = emailValue.trim();
    if (!email || emailBusy || messages.length === 0) return;
    setNotice(null);
    setEmailBusy(true);
    try {
      const res = await fetch("/api/assistant/export-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, messages: messages.map(({ role, content }) => ({ role, content })) }),
      });
      if (res.status === 503) {
        setNotice("Emailing the transcript isn't set up yet — please copy the conversation for now.");
        return;
      }
      if (res.status === 429) {
        setNotice("Too many requests — please wait a moment and try again.");
        return;
      }
      if (res.status === 400) {
        setNotice("Please enter a valid email address.");
        return;
      }
      if (!res.ok) {
        setNotice("Couldn't send the email. Please try again.");
        return;
      }
      setNotice(`Sent! Your conversation is on its way to ${email}.`);
      setEmailOpen(false);
      setEmailValue("");
    } catch {
      setNotice("Couldn't send the email. Check your connection and try again.");
    } finally {
      setEmailBusy(false);
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
      <div className="fixed bottom-5 right-5 z-50 flex items-end gap-3">
        {isWebsite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="hidden max-w-56 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-lg sm:block"
          >
            <span className="block text-sm font-semibold text-ink">Need help?</span>
            <span className="mt-0.5 block text-xs text-muted">Send a message to our team.</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </button>
      </div>
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

        {(busy || uploading) && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {uploading ? "Uploading…" : "Thinking…"}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-muted">{notice}</div>
        )}
      </div>

      {/* Website: email-this-conversation bar */}
      {isWebsite && messages.length > 0 && (
        <div className="border-t border-line bg-surface px-3 py-2">
          {emailOpen ? (
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && exportTranscript()}
                placeholder="you@email.com"
                className="h-9 flex-1 rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <button
                type="button"
                onClick={exportTranscript}
                disabled={emailBusy || !emailValue.trim()}
                className="h-9 rounded-lg bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {emailBusy ? "Sending…" : "Send"}
              </button>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                aria-label="Cancel"
                className="rounded-lg p-1.5 text-muted hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:text-brand-600"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email me this conversation
            </button>
          )}
        </div>
      )}

      {/* Persistent suggestion chips (once the conversation has started) */}
      {messages.length > 0 && !emailOpen && (
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
          {isMember && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || busy}
                aria-label="Attach a document"
                title="Attach a document (PDF, JPG, PNG)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
              </button>
            </>
          )}
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
            Powered by <span className="font-semibold text-ink">Phoenix Creative Works</span>
          </span>
          <span>{FOOTER_NOTE[surface]}</span>
        </div>
      </div>
    </div>
  );
}
