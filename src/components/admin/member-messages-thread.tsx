/**
 * ADMIN MIRROR — the member's Messages rendered as the conversation thread the
 * member sees on /account/messages (via MessagesPanel), but read-only. Sorted
 * chronologically (oldest → newest) to match the member's view. Each entry
 * shows who it's from, subject, body, sent date, and read/unread state.
 *
 * Data shape mirrors the member's messages rows.
 */

export interface MemberMessage {
  id: string;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  is_read: boolean | null;
  created_at: string | null;
  sender_role: string | null;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}

export function MemberMessagesThread({ messages }: { messages: MemberMessage[] }) {
  // Member's panel orders chronologically (ascending). Mirror that here so the
  // admin reads the same conversation flow the client does.
  const ordered = [...messages].sort((a, b) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aT - bT;
  });

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-bg px-5 py-10 text-center text-sm text-muted">
        No messages yet. Messages between this member and ABCAC will appear here.
      </div>
    );
  }

  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
      {ordered.map((m) => {
        const mine = m.sender_role === "member";
        const unread = !m.is_read && !mine;
        return (
          <div key={m.id} className="p-4">
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${unread ? "bg-brand" : "bg-line"}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm ${unread ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                    {m.subject ?? "—"}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      unread ? "border-brand/40 bg-brand/10 text-brand" : "border-line text-muted"
                    }`}
                  >
                    {mine ? "Sent" : unread ? "Unread" : "Read"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {mine ? "Member → ABCAC" : (m.from_name ?? "ABCAC Admin")} · {fmt(m.created_at)}
                </div>
                {m.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{m.body}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
