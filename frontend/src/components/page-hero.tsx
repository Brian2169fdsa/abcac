interface PageHeroProps {
  title: string;
  intro?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

/** Shared hero for interior pages. */
export function PageHero({ title, intro, eyebrow, children }: PageHeroProps) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto w-full max-w-content px-5 py-14 md:px-8 md:py-20">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">{eyebrow}</p>}
        <h1 className="max-w-3xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-muted">{intro}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
