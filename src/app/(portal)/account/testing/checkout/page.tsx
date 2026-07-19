import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { TestingCheckoutButton } from "./testing-checkout-button";

export const dynamic = "force-dynamic";

export default async function TestingCheckoutPage({ searchParams }: { searchParams: { id?: string } }) {
  const memberId = await requireUserId();
  if (!searchParams.id) redirect("/account/testing");
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin.from("testing_requests").select("id,exam_code,testing_mode,seeks_abcac_credential,credential_level,status").eq("id", searchParams.id).eq("member_id", memberId).maybeSingle();
  if (!request || request.status !== "awaiting_payment") redirect("/account/testing");
  const total = (request.testing_mode === "remote" ? 275 : 225) + (request.seeks_abcac_credential ? 150 : 0);
  return <div className="mx-auto max-w-xl px-5 py-24"><div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-lg"><p className="text-sm font-semibold uppercase tracking-wider text-brand">Resume payment</p><h1 className="mt-3">{request.exam_code} Exam Registration</h1><p className="mt-3 text-muted">{request.testing_mode === "remote" ? "Remote-proctored" : "In-person"} exam{request.seeks_abcac_credential ? ` plus ${request.credential_level} certification processing` : ""}.</p><p className="mt-6 text-4xl font-bold text-brand">${total}.00</p><TestingCheckoutButton requestId={request.id} /></div></div>;
}
