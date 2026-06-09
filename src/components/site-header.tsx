"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { HEADER_CTA, MEMBER_PORTAL } from "@/lib/nav";
import { siteConfig } from "@/lib/site-config";
import { CtaButton } from "@/components/cta-button";
import { MegaMenu } from "@/components/mega-menu";
import { MobileNav } from "@/components/mobile-nav";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={cn("sticky top-0 z-50 bg-surface/95 backdrop-blur transition-shadow", scrolled && "shadow-sm")}>
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-3 px-4 sm:gap-4 sm:px-5 md:px-8">
        <Link href="/" className="flex min-w-0 flex-col leading-none" aria-label={`${siteConfig.shortName} home`}>
          <span className="font-display text-lg font-bold text-brand sm:text-xl">{siteConfig.shortName}</span>
          <span className="truncate text-[10px] uppercase tracking-wider text-muted">Arizona Board for Certification</span>
        </Link>

        <nav aria-label="Primary"><MegaMenu /></nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <CtaButton href={HEADER_CTA.href} variant="outline" size="sm" className="hidden lg:inline-flex">
            {HEADER_CTA.label}
          </CtaButton>
          <CtaButton href={MEMBER_PORTAL.href} size="sm" className="hidden md:inline-flex">
            {MEMBER_PORTAL.label}
          </CtaButton>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink xl:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile drawer (sub-xl) */}
      <MobileNav open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
