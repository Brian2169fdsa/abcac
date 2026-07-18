"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { HEADER_CTA } from "@/lib/nav";
import { siteConfig } from "@/lib/site-config";
import { CtaButton } from "@/components/cta-button";
import { Button } from "@/components/ui/button";
import { MegaMenu } from "@/components/mega-menu";
import { MobileNav } from "@/components/mobile-nav";
import { MemberPortalPreviewPopover } from "@/components/member-portal-preview-popover";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [portalPreviewOpen, setPortalPreviewOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("portal") === "coming-soon") setPortalPreviewOpen(true);
  }, [pathname]);

  function closePortalPreview() {
    setPortalPreviewOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("portal")) {
      url.searchParams.delete("portal");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  return (
    <>
      <header className={cn("sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur-xl transition-all", scrolled && "shadow-[0_10px_35px_-24px_rgba(13,34,63,0.45)]")}>
        <div className="mx-auto flex h-[4.5rem] w-full max-w-content items-center justify-between gap-3 px-4 sm:gap-4 sm:px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${siteConfig.shortName} home`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-600 font-display text-lg font-bold text-white shadow-md shadow-brand/15">A</span>
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-lg font-bold text-brand sm:text-xl">{siteConfig.shortName}</span>
              <span className="mt-1 truncate text-[9px] uppercase tracking-[0.16em] text-muted sm:text-[10px]">Arizona Board for Certification</span>
            </span>
          </Link>

          <nav aria-label="Primary"><MegaMenu /></nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <CtaButton href={HEADER_CTA.href} variant="outline" size="sm" className="hidden lg:inline-flex">
              {HEADER_CTA.label}
            </CtaButton>
            <Button type="button" size="sm" className="hidden md:inline-flex" onClick={() => setPortalPreviewOpen(true)}>
              Member Portal
            </Button>
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
      </header>

      {/* Mobile drawer (sub-xl). Rendered OUTSIDE the <header>: the header's
          `backdrop-blur` creates a containing block for fixed-position
          descendants, which otherwise traps this `fixed inset-0` drawer inside
          the 64px header box instead of covering the viewport. */}
      <MobileNav
        open={open}
        onClose={() => setOpen(false)}
        onPortalOpen={() => {
          setOpen(false);
          setPortalPreviewOpen(true);
        }}
      />
      <MemberPortalPreviewPopover open={portalPreviewOpen} onClose={closePortalPreview} />
    </>
  );
}
