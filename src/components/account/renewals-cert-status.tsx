/**
 * Renewal-specific status pill that reflects a credential's position in its
 * renewal window: active (plenty of time), expiring soon, in grace, or expired.
 * Kept self-contained (prefixed) so it can be tuned independently of the shared
 * StatusChip without collision risk.
 */
export type RenewalTone = "active" | "soon" | "grace" | "expired";

const TONES: Record<RenewalTone, string> = {
  active: "bg-green-100 text-green-800",
  soon: "bg-amber-100 text-amber-700",
  grace: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

export function RenewalCertStatus({ tone, label }: { tone: RenewalTone; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
