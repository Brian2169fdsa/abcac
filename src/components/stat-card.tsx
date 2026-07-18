interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-brand/10 bg-surface p-5 shadow-[0_16px_45px_-28px_rgba(13,34,63,0.45)] transition duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-[0_22px_55px_-28px_rgba(123,31,31,0.35)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand/70 to-info" aria-hidden />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/[0.04] transition-transform duration-300 group-hover:scale-125" aria-hidden />
      <div className="relative font-display text-3xl font-bold tracking-tight text-brand sm:text-4xl">{value}</div>
      <div className="relative mt-2 font-semibold leading-snug text-ink">{label}</div>
      {sublabel && <p className="relative mt-2 text-sm leading-relaxed text-muted">{sublabel}</p>}
    </div>
  );
}
