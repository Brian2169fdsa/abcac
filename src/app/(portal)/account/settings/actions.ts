"use server";

// Member privacy control for the public directory (migration 035).
//
// A member toggles whether their active credential is publicly listed in the
// /directory + self-verifiable at /verify. Auth-bound: we read the signed-in
// user and update ONLY their own profiles row (id = user.id). RLS
// ("members_own_profile") enforces the same scoping at the DB layer, so this is
// safe even though we pass the id explicitly. Revalidate the account area so the
// settings page reflects the new state.

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateDirectoryListing(
  optOut: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const { error } = await sb
    .from("profiles")
    .update({ directory_opt_out: optOut })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/account/settings");
  return { ok: true };
}
