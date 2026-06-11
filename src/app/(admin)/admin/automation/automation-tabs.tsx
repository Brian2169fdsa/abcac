"use client";

// ABCAC — sub-navigation for the automation section. Rendered at the top of
// every automation page so the Console / Analytics / Workflows / Audit / Config
// surfaces feel like one tool. Active state is path-prefix aware.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { label: string; href: string; exact?: boolean }[] = [
  { label: "Console", href: "/admin/automation", exact: true },
  { label: "Analytics", href: "/admin/automation/analytics" },
  { label: "Workflows", href: "/admin/automation/workflows" },
  { label: "Audit", href: "/admin/automation/audit" },
  { label: "Config", href: "/admin/automation/config" },
];

export function AutomationTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line" aria-label="Automation sections">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors " +
              (active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:border-line hover:text-ink")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
