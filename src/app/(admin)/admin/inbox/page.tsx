import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BOARD_PREFIX = "BOARD MEMBER APPLICATION";

interface ContactMessageRow {
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string | null;
}

function fmt(d: string | null) {
  return d
    ? new Date(d).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

export default async function AdminInbox() {
  const sb = createSupabaseServerClient();
  const { data } = await sb
    .from("contact_messages")
    .select("name,email,phone,message,created_at")
    .order("created_at", { ascending: false });

  const rows = (data as ContactMessageRow[]) ?? [];

  return (
    <>
      <h1 className="text-2xl font-bold">Inbox</h1>
      <p className="mb-6 text-muted">
        Submissions from the public contact form and board member applications. Every submission is recorded here even
        if the email notification fails.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-12 text-center text-muted">
          No messages yet. New contact and board-application submissions will appear here.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((m, i) => {
            const isBoard = (m.message ?? "").startsWith(BOARD_PREFIX);
            return (
              <li key={i} className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand">{m.name || "—"}</span>
                    <span
                      className={
                        isBoard
                          ? "rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold leading-none text-white"
                          : "rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-brand"
                      }
                    >
                      {isBoard ? "Board Application" : "Contact"}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{fmt(m.created_at)}</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className="font-medium text-brand hover:text-brand-600">
                      {m.email}
                    </a>
                  ) : (
                    <span>—</span>
                  )}
                  <span>{m.phone || "No phone"}</span>
                </div>

                <p className="whitespace-pre-wrap text-sm text-ink">{m.message || "—"}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
