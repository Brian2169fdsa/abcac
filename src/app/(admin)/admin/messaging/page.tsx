import { SendMessageForm, type MemberOption } from "@/components/admin/send-message-form";
import { AdminMessaging, type AdminMessage, type ThreadMember } from "@/components/admin/admin-messaging";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMessagingPage() {
  const sb = createSupabaseServerClient();

  const [{ data: profiles }, { data: messages }] = await Promise.all([
    sb.from("profiles").select("id,first_name,last_name,email").order("first_name", { ascending: true }),
    sb.from("messages").select("*").order("created_at", { ascending: true }),
  ]);

  const memberOptions: MemberOption[] = (profiles ?? []).map((p: any) => ({
    id: p.id,
    label: ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.email) + ` (${p.email})`,
  }));

  const threadMembers: ThreadMember[] = (profiles ?? []).map((p: any) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown member",
    email: p.email ?? null,
  }));

  const allMessages = (messages ?? []) as AdminMessage[];
  const totalUnread = allMessages.filter((m) => m.sender_role === "member" && !m.is_read).length;

  return (
    <>
      <h1 className="text-2xl font-bold">Messaging</h1>
      <p className="mb-6 text-muted">
        Two-way member messaging. Member replies appear below as threads; open a thread to read and reply.
        {totalUnread > 0 && (
          <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
            {totalUnread} unread
          </span>
        )}
      </p>

      <h2 className="mb-3 text-lg font-semibold">Compose new message</h2>
      <div className="mb-10">
        <SendMessageForm members={memberOptions} />
      </div>

      <h2 className="mb-3 text-lg font-semibold">All threads</h2>
      <AdminMessaging initialMessages={allMessages} members={threadMembers} />
    </>
  );
}
