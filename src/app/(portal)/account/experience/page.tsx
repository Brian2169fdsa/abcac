import type { ReactNode } from "react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { AddEmploymentForm, EditEmploymentForm, AddOtherCertForm, AddSupervisionForm } from "@/components/portal-forms";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Experience & Credentials" };
export const dynamic = "force-dynamic";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            {head.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-3 text-muted">{c ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ExperiencePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  // Supervision the member RECEIVES (they are the linked supervisee). Wrapped so
  // a not-yet-applied migration 023 (no supervisee_member_id column / no RLS
  // read policy) degrades to empty instead of breaking the page.
  let supervisedBy: any[] = [];
  try {
    const { data, error } = await supabase
      .from("supervision_records")
      .select("*, supervisor:supervisor_id(first_name,last_name,email)")
      .eq("supervisee_member_id", uid)
      .order("start_date", { ascending: false });
    if (!error) supervisedBy = data ?? [];
  } catch { /* migration 023 not applied — leave empty */ }

  const [{ data: emp }, { data: certs }, { data: sup }] = await Promise.all([
    supabase.from("employment_records").select("*").eq("member_id", uid).order("start_date", { ascending: false }),
    supabase.from("other_certifications").select("*").eq("member_id", uid).order("issued_date", { ascending: false }),
    supabase.from("supervision_records").select("*").eq("supervisor_id", uid).order("start_date", { ascending: false }),
  ]);

  function supervisorName(s: any): string {
    const sup = s.supervisor;
    if (sup) {
      const n = [sup.first_name, sup.last_name].filter(Boolean).join(" ");
      return n || sup.email || "Your supervisor";
    }
    return "Your supervisor";
  }

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Experience & Credentials" intro="Record your work history, other certifications, and any clinical supervision you provide." />

      <Section compact title="Employment History">
        <Table
          head={["Employer", "Position", "Start", "End", ""]}
          rows={(emp ?? []).map((e) => [
            e.employer_name, e.position_title, fmt(e.start_date), e.is_current ? "Present" : fmt(e.end_date),
            <EditEmploymentForm key="edit" record={{ id: e.id, employer_name: e.employer_name, position_title: e.position_title, start_date: e.start_date, end_date: e.end_date, is_current: e.is_current }} />,
          ])}
          empty="No employment records yet."
        />
        <div className="mt-4"><AddEmploymentForm /></div>
      </Section>

      <Section compact surface title="Other Certifications">
        <Table
          head={["Credential", "Number", "Issuing Board", "Issued", "Expires", "Document"]}
          rows={(certs ?? []).map((c) => [
            c.credential_title, c.credential_number, c.issuing_board, fmt(c.issued_date), fmt(c.expiration_date),
            c.doc_path ? <ViewFileButton bucket="member-documents" path={c.doc_path} label="View" /> : "—",
          ])}
          empty="No other certifications recorded."
        />
        <div className="mt-4"><AddOtherCertForm /></div>
      </Section>

      <Section compact title="Clinical Supervision">
        <p className="mb-4 max-w-3xl text-sm text-muted">If you hold or are pursuing the CCS credential, record the supervision you provide here.</p>
        <Table
          head={["Supervisee", "Credential", "Start", "End", "Status"]}
          rows={(sup ?? []).map((s) => [s.supervisee_name, s.supervisee_credential, fmt(s.start_date), s.end_date ? fmt(s.end_date) : "Present", s.status])}
          empty="No supervision records yet."
        />
        <div className="mt-4"><AddSupervisionForm /></div>
      </Section>

      {supervisedBy.length > 0 && (
        <Section compact surface title="Supervision You Receive">
          <p className="mb-4 max-w-3xl text-sm text-muted">Supervision records where an ABCAC supervisor has linked you as their supervisee.</p>
          <Table
            head={["Supervised by", "Your credential", "Start", "End", "Status"]}
            rows={supervisedBy.map((s) => [
              supervisorName(s),
              s.supervisee_credential,
              fmt(s.start_date),
              s.end_date ? fmt(s.end_date) : "Present",
              s.status,
            ])}
            empty="You are not currently recorded as a supervisee."
          />
        </Section>
      )}
    </>
  );
}
