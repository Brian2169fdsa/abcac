import Link from "next/link";

/** A quick-action tile: icon chip + label, linking to a real /account route. */
export interface QuickAction {
  href: string;
  label: string;
  /** Emoji glyph shown in the gold chip (matches the static portal). */
  icon: string;
}

/**
 * The row of quick-action tiles on the home dashboard, mirroring the static
 * portal's `.quick-grid` (Log CEU Hours, Renew, View Certificate, etc.).
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {actions.map((a) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4 text-sm font-medium text-ink transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
        >
          <span
            aria-hidden
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10 text-lg"
          >
            {a.icon}
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  );
}
