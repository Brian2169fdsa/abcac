"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AdminCounts = {
  approvals: number;
  documents: number;
  ceus: number;
  requests: number;
};

type CountKey = keyof AdminCounts;

const ITEMS: { label: string; href: string; count?: CountKey }[] = [
  { label: "AI Agent", href: "/admin/agent" },
  { label: "Dashboard", href: "/admin" },
  { label: "Inbox", href: "/admin/inbox" },
  { label: "Automation", href: "/admin/automation" },
  { label: "Account Approvals", href: "/admin/approvals", count: "approvals" },
  { label: "Documents", href: "/admin/documents", count: "documents" },
  { label: "CEU Review", href: "/admin/ceus", count: "ceus" },
  { label: "Applications", href: "/admin/applications" },
  { label: "Requests", href: "/admin/requests", count: "requests" },
  { label: "Members", href: "/admin/members" },
  { label: "Messaging", href: "/admin/messaging" },
  { label: "Invoices", href: "/admin/invoices" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Schedules", href: "/admin/schedules" },
  { label: "Search", href: "/admin/search" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Finance", href: "/admin/finance" },
  { label: "Renewals", href: "/admin/renewals" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Audit Log", href: "/admin/audit" },
];

/** Self-contained maroon count badge; renders nothing when count <= 0. */
function CountBadge({ n }: { n: number }) {
  if (!n || n < 1) return null;
  return (
    <span className="ml-2 min-w-[20px] rounded-full bg-brand px-2 py-0.5 text-center text-[11px] font-bold leading-none text-white">
      {n}
    </span>
  );
}

export function AdminNav({ counts, onNavigate }: { counts: AdminCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col" aria-label="Admin">
      {ITEMS.map((t) => {
        const active = t.href === "/admin" ? pathname === t.href : pathname.startsWith(t.href);
        const n = t.count ? counts[t.count] : 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between border-l-[3px] px-5 py-2.5 text-sm transition-colors",
              active
                ? "border-accent bg-accent/10 font-semibold text-brand"
                : "border-transparent text-ink/75 hover:bg-bg hover:text-brand",
            )}
          >
            <span>{t.label}</span>
            <CountBadge n={n} />
          </Link>
        );
      })}
    </nav>
  );
}
