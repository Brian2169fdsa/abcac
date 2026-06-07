import { SendMessageForm, type MemberOption } from "@/components/admin/send-message-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function memberOptions(): Promise<MemberOption[]> {
  const sb = createSupabaseServerClient();
  const { data } = await sb.from("profiles").select("id,first_name,last_name,email").order("first_name", { ascending: true });
  return (data ?? []).map((p: any) => ({
    id: p.id,
    label: ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.email) + ` (${p.email})`,
  }));
}

export default async function AdminMessaging() {
  const members = await memberOptions();
  return (
    <>
      <h1 className="text-2xl font-bold">Send Message</h1>
      <p className="mb-6 text-muted">Deliver a message to a member&apos;s portal inbox.</p>
      <SendMessageForm members={members} />
    </>
  );
}
