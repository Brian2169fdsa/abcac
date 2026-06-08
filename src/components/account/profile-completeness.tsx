/**
 * Profile completeness meter for the member Profile page. Computes the share
 * of key contact fields that are filled and renders a brand-matched progress
 * bar with a short list of any remaining items.
 */
interface CompletenessField {
  label: string;
  value: string | null | undefined;
}

export function ProfileCompleteness({ fields }: { fields: CompletenessField[] }) {
  const total = fields.length;
  const filled = fields.filter((f) => f.value != null && String(f.value).trim() !== "").length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 100;
  const missing = fields.filter((f) => f.value == null || String(f.value).trim() === "").map((f) => f.label);
  const complete = missing.length === 0;

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Profile completeness</div>
        {complete ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            Complete
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            {pct}% complete
          </span>
        )}
      </div>
      <div className="mt-1 font-display text-3xl font-bold text-brand">
        {filled} / {total}
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Profile fields completed"
      >
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      {!complete && (
        <p className="mt-3 text-sm text-muted">
          Add the following to complete your profile:{" "}
          <span className="font-medium text-ink">{missing.join(", ")}</span>.
        </p>
      )}
    </div>
  );
}
