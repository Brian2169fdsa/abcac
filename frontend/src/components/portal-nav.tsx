"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/account" },
  { label: "Certifications", href: "/account/certifications" },
  { label: "CEU Tracker", href: "/account/ceus" },
  { label: "Documents", href: "/account/documents" },
  { label: "Experience", href: "/account/experience" },
  { label: "Apply", href: "/account/apply" },
  { label: "Recertify", href: "/account/renew" },
  { label: "Requests", href: "/account/requests" },
  { label: "Invoices", href: "/account/invoices" },
  { label: "Messages", href: "/account/messages" },
  { label: "Profile", href: "/account/profile" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-line bg-surface">
      <nav className="mx-auto flex w-full max-w-content gap-1 overflow-x-auto px-3 md:px-6" aria-label="Member portal">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                active ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
