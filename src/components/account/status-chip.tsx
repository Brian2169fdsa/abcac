/**
 * Small status pill used across portal pages (documents, experience, etc.).
 * Maps a free-form status string to a tasteful brand-token color treatment.
 */
const TONES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-800",
  submitted: "bg-info/10 text-info",
  open: "bg-amber-100 text-amber-800",
};

export function StatusChip({ status }: { status: string | null | undefined }) {
  const key = (status ?? "pending").toLowerCase();
  const tone = TONES[key] ?? "bg-line text-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {status ?? "pending"}
    </span>
  );
}
