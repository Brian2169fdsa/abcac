interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="font-display text-4xl font-bold text-brand">{value}</div>
      <div className="mt-1 font-semibold">{label}</div>
      {sublabel && <p className="mt-1 text-sm text-muted">{sublabel}</p>}
    </div>
  );
}
