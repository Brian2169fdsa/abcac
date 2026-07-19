import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(cents: number | null, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
}

function display(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export default async function AdminPaymentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: payment } = await supabase.from("payments").select("*").eq("id", params.id).maybeSingle();
  if (!payment) notFound();

  const { data: submission } = payment.payment_submission_id
    ? await supabase.from("payment_submissions").select("*").eq("id", payment.payment_submission_id).maybeSingle()
    : { data: null };

  const fields = submission ? [
    ["Form type", submission.form_type],
    ["Payer", `${submission.payer_first_name} ${submission.payer_last_name}`],
    ["Email", submission.payer_email],
    ["Phone", submission.payer_phone],
    ["Credential level", submission.credential_level],
    ["Exam mode", submission.exam_mode],
    ["Reference number", submission.reference_number],
    ["Notes", submission.notes],
    ["Linked record", submission.linked_record_type && submission.linked_record_id ? `${submission.linked_record_type}: ${submission.linked_record_id}` : null],
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/finance" className="text-sm font-semibold text-brand hover:underline">← Back to Finance</Link>
        <h1 className="mt-3 text-2xl font-bold">Payment details</h1>
        <p className="text-muted">Stripe payment and its attached processing form.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5"><div className="text-xs uppercase text-muted">Amount</div><div className="mt-1 text-2xl font-bold text-brand">{money(payment.amount_cents, payment.currency)}</div></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="text-xs uppercase text-muted">Product</div><div className="mt-1 font-bold">{payment.product_name || payment.slug || "Payment"}</div></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="text-xs uppercase text-muted">Status</div><div className="mt-1 font-bold capitalize">{payment.status}</div></div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold">Attached form</h2>
        {!submission ? <p className="mt-3 text-sm text-red-700">No payment form is linked to this older Stripe transaction.</p> : (
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {fields.map(([label, value]) => <div key={String(label)}><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{display(value)}</dd></div>)}
          </dl>
        )}
      </section>

      {submission && (
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">Form payload</h2>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg p-4 text-xs">{JSON.stringify(submission.form_payload ?? {}, null, 2)}</pre>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5 text-sm">
        <div><span className="font-semibold">Stripe session:</span> {payment.stripe_session_id || "—"}</div>
        <div className="mt-2"><span className="font-semibold">Stripe event:</span> {payment.stripe_event_id || "—"}</div>
      </section>
    </div>
  );
}
