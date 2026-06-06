"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Compliance", href: "/admin/compliance" },
  { label: "Approvals", href: "/admin/approvals" },
  { label: "Documents", href: "/admin/documents" },
  { label: "CEUs", href: "/admin/ceus" },
  { label: "Applications", href: "/admin/applications" },
  { label: "Requests", href: "/admin/requests" },
  { label: "Members", href: "/admin/members" },
  { label: "Send Message", href: "/admin/messaging" },
  { label: "Create Invoice", href: "/admin/invoices" },
  { label: "Audit Log", href: "/admin/audit" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Admin">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
