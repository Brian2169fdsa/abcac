import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScheduleEditor, type ScheduleRow } from "@/components/admin/schedule-editor";

export const metadata = { title: "Cert Schedules" };
export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  const supabase = createSupabaseServerClient();

  let schedules: ScheduleRow[] = [];
  let loadError = false;
  try {
    const { data, error } = await supabase
      .from("cert_schedules")
      .select(
        "id, credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
      )
      .order("credential_type", { ascending: true });
    if (error) throw error;
    schedules = (data as ScheduleRow[]) ?? [];
  } catch {
    loadError = true;
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Cert Schedules</h1>
      <p className="mb-6 text-muted">
        Renewal-cycle and CEU rules per credential. These power renewal due dates, CEU
        compliance, and the daily renewal reminders. Members can read these; only admins can edit.
      </p>

      {loadError ? (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-6 text-muted">
          Couldn&apos;t load cert schedules. If the <code>cert_schedules</code> table or its RLS
          policy is missing, apply migration 016 and try again.
        </div>
      ) : (
        <ScheduleEditor schedules={schedules} />
      )}
    </>
  );
}
