import { requireUserId } from "@/lib/auth/current-user";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { AddEmploymentForm, EditEmploymentForm, AddSupervisionForm } from "@/components/portal-forms";
import { SectionCard } from "@/components/account/section-card";
import { DataTable } from "@/components/account/data-table";
import { StatusChip } from "@/components/account/status-chip";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Experience & Credentials" };
export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

/** Profile fields joined in via `supervisor:supervisor_id(...)`. */
interface SupervisorProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

/** A supervision_records row, optionally with the supervisor profile join. */
interface SupervisionRecord {
  id: string;
  supervisee_name: string | null;
  supervisee_credential: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  supervisor?: SupervisorProfile | null;
}

export default async function ExperiencePage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();
  const uid = __authUserId;

  // Supervision the member RECEIVES (they are the linked supervisee). Wrapped so
  // a not-yet-applied migration 023 (no supervisee_member_id column / no RLS
  // read policy) degrades to empty instead of breaking the page.
  let supervisedBy: SupervisionRecord[] = [];
  try {
    const { data, error } = await supabase
      .from("supervision_records")
      .select("*, supervisor:supervisor_id(first_name,last_name,email)")
      .eq("supervisee_member_id", uid)
      .order("start_date", { ascending: false });
    if (!error) supervisedBy = (data as SupervisionRecord[] | null) ?? [];
  } catch { /* migration 023 not applied — leave empty */ }

  const [{ data: emp }, { data: sup }] = await Promise.all([
    supabase.from("employment_records").select("*").eq("member_id", uid).order("start_date", { ascending: false }),
    supabase.from("supervision_records").select("*").eq("supervisor_id", uid).order("start_date", { ascending: false }),
  ]);

  function supervisorName(s: SupervisionRecord): string {
    const sup = s.supervisor;
    if (sup) {
      const n = [sup.first_name, sup.last_name].filter(Boolean).join(" ");
      return n || sup.email || "Your supervisor";
    }
    return "Your supervisor";
  }

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Experience & Credentials" intro="Record your work history and any clinical supervision you provide. Certifications from other organizations now live on the Certificate & Wallet Card page." />

      <Section compact title="Employment History">
        <SectionCard title="Employment records" action={<AddEmploymentForm />}>
          <DataTable
            head={["Employer", "Position", "Start", "End", ""]}
            rows={(emp ?? []).map((e) => [
              e.employer_name, e.position_title, fmt(e.start_date), e.is_current ? "Present" : fmt(e.end_date),
              <EditEmploymentForm key="edit" record={{ id: e.id, employer_name: e.employer_name, position_title: e.position_title, start_date: e.start_date, end_date: e.end_date, is_current: e.is_current }} />,
            ])}
            empty="No employment records yet. Add your work history to support your application."
          />
        </SectionCard>
      </Section>

      <Section compact id="supervision" title="Clinical Supervision">
        <SectionCard
          title="Supervision you provide"
          description="If you hold or are pursuing the CCS credential, record the supervision you provide here."
          action={<AddSupervisionForm />}
        >
          <DataTable
            head={["Supervisee", "Credential", "Start", "End", "Status"]}
            rows={((sup ?? []) as SupervisionRecord[]).map((s) => [
              s.supervisee_name,
              s.supervisee_credential,
              fmt(s.start_date),
              s.end_date ? fmt(s.end_date) : "Present",
              s.status ? <StatusChip status={s.status} /> : "—",
            ])}
            empty="No supervision records yet."
          />
        </SectionCard>
      </Section>

      {supervisedBy.length > 0 && (
        <Section compact title="Supervision You Receive">
          <SectionCard
            title="Supervision you receive"
            description="Supervision records where an ABCAC supervisor has linked you as their supervisee."
          >
            <DataTable
              head={["Supervised by", "Your credential", "Start", "End", "Status"]}
              rows={supervisedBy.map((s) => [
                supervisorName(s),
                s.supervisee_credential,
                fmt(s.start_date),
                s.end_date ? fmt(s.end_date) : "Present",
                s.status ? <StatusChip status={s.status} /> : "—",
              ])}
              empty="You are not currently recorded as a supervisee."
            />
          </SectionCard>
        </Section>
      )}
    </>
  );
}
