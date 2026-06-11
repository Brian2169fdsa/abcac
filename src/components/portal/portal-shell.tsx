"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/notifications";

/**
 * Portal chrome: maroon top bar + white brand bar, a fixed ~280px left sidebar
 * on desktop, and a slide-in drawer on mobile. Page content renders unchanged
 * in the main area. Mirrors the static portal (public/portal/index.html).
 */
export function PortalShell({
  memberName,
  messageCount,
  isAdmin = false,
  notificationCount = 0,
  notifications = [],
  children,
}: {
  memberName: string;
  messageCount?: number;
  isAdmin?: boolean;
  notificationCount?: number;
  notifications?: Notification[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Fixed top + brand bars */}
      <div className="fixed inset-x-0 top-0 z-40">
        <PortalTopbar
          memberName={memberName}
          messageCount={messageCount}
          isAdmin={isAdmin}
          notificationCount={notificationCount}
          notifications={notifications}
          onMenuToggle={() => setDrawerOpen((o) => !o)}
        />
      </div>

      {/* Spacer for the fixed chrome (top bar + brand bar heights). */}
      <div className="h-[88px] md:h-[120px]" aria-hidden />

      <div className="flex">
        {/* Desktop sidebar (fixed) */}
        <PortalSidebar isAdmin={isAdmin} className="fixed bottom-0 left-0 top-[120px] z-30 hidden lg:block" />

        {/* Mobile drawer + overlay */}
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}
        <div
          className={cn(
            "fixed bottom-0 left-0 top-0 z-50 pt-[88px] shadow-xl transition-transform duration-300 lg:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <PortalSidebar isAdmin={isAdmin} className="h-full" onClose={() => setDrawerOpen(false)} />
        </div>

        {/* Main content */}
        <main id="main" className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-8 lg:ml-[280px]">
          {children}
        </main>
      </div>
    </div>
  );
}
