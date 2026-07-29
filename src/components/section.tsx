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
  /** Anchor target (sidebar deep-links jump here). */
  id?: string;
}

/** Vertical-rhythm wrapper that every page composes from. */
export function Section({ children, eyebrow, title, intro, className, compact, surface, id }: SectionProps) {
  return (
    <section id={id} className={cn("relative", surface && "bg-surface", className, id && "scroll-mt-32")}>
      <div
        className={cn(
          "mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8",
          compact ? "py-12 sm:py-14 md:py-16" : "py-16 sm:py-20 lg:py-28",
        )}
      >
        {(eyebrow || title || intro) && (
          <div className="mb-10 max-w-3xl sm:mb-12">
            {eyebrow && (
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 bg-brand" aria-hidden />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
              </div>
            )}
            {title && <h2>{title}</h2>}
            {intro && <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
