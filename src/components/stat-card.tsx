interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="group modern-surface relative overflow-hidden rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-[0_26px_65px_-35px_rgba(123,31,31,0.32)] sm:p-6">
      <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-brand via-brand/70 to-info" aria-hidden />
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border-[18px] border-brand/[0.035] transition-transform duration-500 group-hover:scale-125" aria-hidden />
      <div className="relative font-display text-3xl font-bold tracking-[-0.04em] text-brand sm:text-4xl">{value}</div>
      <div className="relative mt-2 font-semibold leading-snug text-ink">{label}</div>
      {sublabel && <p className="relative mt-2 text-sm leading-relaxed text-muted">{sublabel}</p>}
    </div>
  );
}
