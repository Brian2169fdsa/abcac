interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="font-display text-3xl font-bold text-brand sm:text-4xl">{value}</div>
      <div className="mt-1 font-semibold">{label}</div>
      {sublabel && <p className="mt-1 text-sm text-muted">{sublabel}</p>}
    </div>
  );
}
