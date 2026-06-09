import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  intro?: string;
  className?: string;
  /** Tighter vertical padding for stacked sections. */
  compact?: boolean;
  surface?: boolean;
}

/** Vertical-rhythm wrapper that every page composes from. */
export function Section({ children, eyebrow, title, intro, className, compact, surface }: SectionProps) {
  return (
    <section className={cn(surface && "bg-surface", className)}>
      <div
        className={cn(
          "mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8",
          compact ? "py-10 sm:py-12 md:py-14" : "py-12 sm:py-16 lg:py-24",
        )}
      >
        {(eyebrow || title || intro) && (
          <div className="mb-8 max-w-2xl sm:mb-10">
            {eyebrow && (
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent-strong">{eyebrow}</p>
            )}
            {title && <h2>{title}</h2>}
            {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
