"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { MENU, MENU_LINKS, HEADER_CTA, MEMBER_PORTAL } from "@/lib/nav";
import { siteConfig } from "@/lib/site-config";
import { CtaButton } from "@/components/cta-button";
import { MegaMenu } from "@/components/mega-menu";
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
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="flex flex-col leading-none" aria-label={`${siteConfig.shortName} home`}>
          <span className="font-display text-xl font-bold text-brand">{siteConfig.shortName}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Arizona Board for Certification</span>
        </Link>

        <nav aria-label="Primary"><MegaMenu /></nav>

        <div className="flex items-center gap-3">
          <CtaButton href={HEADER_CTA.href} variant="outline" size="sm" className="hidden lg:inline-flex">
            {HEADER_CTA.label}
          </CtaButton>
          <CtaButton href={MEMBER_PORTAL.href} size="sm" className="hidden md:inline-flex">
            {MEMBER_PORTAL.label}
          </CtaButton>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink xl:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-0 h-full w-[84%] max-w-sm overflow-y-auto bg-surface p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-brand">{siteConfig.shortName}</span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </div>
            <nav className="flex flex-col gap-5" aria-label="Mobile">
              {MENU.map((group) => (
                <div key={group.label}>
                  <div className="mb-1 px-3 text-xs font-bold uppercase tracking-wide text-accent-strong">{group.label}</div>
                  {group.links.map((link) =>
                    link.href.startsWith("http") ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg px-3 py-2 text-base font-semibold text-ink hover:bg-line/60"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={pathname === link.href ? "page" : undefined}
                        className="block rounded-lg px-3 py-2 text-base font-semibold text-ink hover:bg-line/60"
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                </div>
              ))}
              <div className="border-t border-line pt-3">
                {MENU_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className="block rounded-lg px-3 py-2 text-base font-semibold text-ink hover:bg-line/60"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
            <CtaButton href={MEMBER_PORTAL.href} className="mt-6 w-full">
              {MEMBER_PORTAL.label}
            </CtaButton>
            <CtaButton href={HEADER_CTA.href} variant="outline" className="mt-3 w-full">
              {HEADER_CTA.label}
            </CtaButton>
          </div>
        </div>
      )}
    </header>
  );
}
