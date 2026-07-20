import Link from "next/link";
import { CheckCircle2, Clock3, CreditCard, FileText } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { requireUserId } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isTestingMode, testingStatusLabel } from "@/lib/testing-requests";
import { TestingRegistrationForm } from "./testing-registration-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam Registration" };

export default async function TestingRegistrationPage({ searchParams }: { searchParams: { mode?: string } }) {
  const memberId = await requireUserId();
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: requests }] = await Promise.all([
    admin.from("profiles").select("first_name,last_name,email,phone,date_of_birth,address_line1,city,state,zip_code").eq("id", memberId).maybeSingle(),
    admin.from("testing_requests").select("id,exam_code,testing_mode,status,payment_status,smt_candidate_id,submitted_at,preregistered_at,created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(10),
  ]);
  const address = [profile?.address_line1, profile?.city, profile?.state, profile?.zip_code].filter(Boolean).join(", ");
  const initialMode = isTestingMode(searchParams.mode ?? "") ? searchParams.mode as "in_person" | "remote" : "in_person";

  return <>
    <PageHero eyebrow="IC&RC Exam Testing" title="Pre-Register for Your Exam" intro="Save your tester information, pay securely, and follow ABCAC’s SMT pre-registration progress from one place." />
    {(requests ?? []).length > 0 && <Section className="pb-0"><div className="rounded-3xl border border-line bg-surface p-6 shadow-sm"><div className="flex items-center gap-3"><Clock3 className="h-6 w-6 text-brand" /><h2 className="text-2xl">Your testing requests</h2></div><div className="mt-5 grid gap-3">{(requests ?? []).map((request: any) => <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{request.exam_code} · {request.testing_mode === "remote" ? "Remote proctored" : "In person"}</p><p className="mt-1 text-sm text-muted">{request.submitted_at ? `Submitted ${new Date(request.submitted_at).toLocaleDateString()}` : request.created_at ? `Started ${new Date(request.created_at).toLocaleDateString()}` : "Not yet submitted"} · {testingStatusLabel(request.status)}</p>{request.smt_candidate_id && <p className="mt-1 text-xs text-muted">SMT reference: {request.smt_candidate_id}</p>}</div>{request.status === "awaiting_payment" ? <Link href={`/account/testing/checkout?id=${request.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white"><CreditCard className="h-4 w-4" /> Complete payment</Link> : <span className="inline-flex items-center gap-2 self-start rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand"><CheckCircle2 className="h-4 w-4" /> {testingStatusLabel(request.status)}</span>}</div>)}</div></div></Section>}
    <Section><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-3xl">New pre-registration request</h2><p className="mt-2 text-muted">Complete every field before continuing to Stripe.</p></div><Link href="/account/forms?workflow=testing%3Aaccommodations" className="inline-flex items-center gap-2 rounded-xl border border-brand px-4 py-2.5 text-sm font-semibold text-brand"><FileText className="h-4 w-4" /> Accommodations form</Link></div><TestingRegistrationForm defaults={{ firstName: profile?.first_name ?? "", lastName: profile?.last_name ?? "", email: profile?.email ?? "", phone: profile?.phone ?? "", address, dateOfBirth: profile?.date_of_birth ?? "" }} initialMode={initialMode} /></Section>
  </>;
}
