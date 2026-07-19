interface PageHeroProps {
  title: string;
  intro?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

/** Shared hero for interior pages — homepage design language: a soft brand
 *  gradient wash, a pill eyebrow chip, and large navy display type. */
export function PageHero({ title, intro, eyebrow, children }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-surface">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-surface via-surface to-brand/[0.06]" aria-hidden />
      <div className="mx-auto w-full max-w-content px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        {eyebrow && (
          <p className="mb-4 inline-flex items-center rounded-full border border-brand/15 bg-brand/[0.05] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">{intro}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
