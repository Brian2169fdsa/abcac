"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_NAV, type PortalNavItem } from "@/components/portal/portal-nav-config";
import { cn } from "@/lib/utils";

/**
 * Decide whether a nav item is "active" for the current pathname.
 *
 * Home (/account) only matches exactly; every other route matches itself and
 * its sub-paths. When several sidebar items share a route (e.g. the three
 * Requests links all point at /account/requests), the first one in the group
 * wins so only a single highlight shows.
 */
function useActiveHref(): string | null {
  const pathname = usePathname();
  let best: string | null = null;
  for (const group of PORTAL_NAV) {
    for (const item of group.items) {
      const matches =
        item.href === "/account"
          ? pathname === "/account"
          : pathname === item.href || pathname.startsWith(item.href + "/");
      if (matches && (best === null || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }
  return best;
}

function NavLink({
  item,
  active,
  variant,
  onNavigate,
}: {
  item: PortalNavItem;
  active: boolean;
  variant: "home" | "link";
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block border-l-[3px] border-transparent transition-colors",
        variant === "home"
          ? "px-6 py-2.5 text-[15px] font-medium text-ink/80"
          : "py-2.5 pl-7 pr-6 text-sm leading-snug text-muted",
        "hover:bg-bg hover:text-brand",
        active && "border-accent bg-accent/10 font-semibold text-brand",
      )}
    >
      {item.label}
    </Link>
  );
}

export function PortalSidebar({
  open,
  onClose,
  className,
}: {
  open?: boolean;
  onClose?: () => void;
  className?: string;
}) {
  const activeHref = useActiveHref();

  // Track the first item per shared href so duplicates don't all highlight.
  const seen = new Set<string>();

  return (
    <nav
      aria-label="Member portal"
      className={cn(
        "w-[280px] overflow-y-auto border-r border-line bg-surface py-5",
        className,
      )}
    >
      {PORTAL_NAV.map((group, gi) => (
        <div key={gi} className={cn(group.divider && "mt-2 border-t border-line pt-2")}>
          {group.heading && (
            <div className="px-6 pb-2 pt-5 text-[13px] font-semibold tracking-wide text-brand">
              {group.heading}
            </div>
          )}
          {group.items.map((item) => {
            const isActiveHref = item.href === activeHref;
            const firstForHref = !seen.has(item.href);
            seen.add(item.href);
            const active = isActiveHref && firstForHref;
            return (
              <NavLink
                key={`${item.href}-${item.label}`}
                item={item}
                active={active}
                variant={item.href === "/account" && !group.heading ? "home" : "link"}
                onNavigate={onClose}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}
