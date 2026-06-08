/**
 * Status pill for invoice/payment states. Maps invoice statuses
 * (paid / open / overdue / pending / void / failed) to brand-token color
 * treatments. Kept invoices-scoped to avoid collisions with the shared chip.
 */
const TONES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  succeeded: "bg-green-100 text-green-800",
  complete: "bg-green-100 text-green-800",
  open: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-info/10 text-info",
  overdue: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  void: "bg-line text-muted",
  canceled: "bg-line text-muted",
};

export function InvoicesStatusChip({ status }: { status: string | null | undefined }) {
  const key = (status ?? "open").toLowerCase();
  const tone = TONES[key] ?? "bg-line text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}
    >
      {status ?? "open"}
    </span>
  );
}
