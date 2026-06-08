import type { ReactNode } from "react";

/**
 * Brand-matched card container for portal content sections. Provides an
 * optional titled header (with right-aligned action slot), consistent padding,
 * and the standard `bg-surface border border-line rounded` chrome.
 */
export function SectionCard({
  title,
  description,
  action,
  bodyClassName,
  children,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Override padding/layout of the body wrapper (e.g. to remove padding for tables). */
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h3 className="font-display text-base font-bold text-ink">{title}</h3>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName ?? "p-5"}>{children}</div>
    </div>
  );
}

/**
 * Centered, friendly empty-state used inside cards when there is no data yet.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-bg px-5 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
