"use server";

// Member notification mark-read actions. Thin auth-bound wrappers over the
// notifications lib; RLS + the lib's member-id pin keep a member to their own
// rows. Revalidate the portal layout so the bell's unread badge refreshes.

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markNotificationsRead, markAllNotificationsRead } from "@/lib/notifications";

export async function markReadAction(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseServerClient();
  const res = await markNotificationsRead(sb, ids);
  if (res.ok) revalidatePath("/account", "layout");
  return res;
}

export async function markAllReadAction(): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseServerClient();
  const res = await markAllNotificationsRead(sb);
  if (res.ok) revalidatePath("/account", "layout");
  return res;
}
