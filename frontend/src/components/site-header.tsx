"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV, HEADER_CTA } from "@/lib/nav";
import { siteConfig } from "@/lib/site-config";
import { CtaButton } from "@/components/cta-button";
import { cn } from "@/lib/utils";

export function SiteHeader({ authed }: { authed: boolean }) {
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

  const accountHref = authed ? "/account" : "/login";
  const accountLabel = authed ? "My Account" : "Login";

  return (
    <header className={cn("sticky top-0 z-50 bg-surface/95 backdrop-blur transition-shadow", scrolled && "shadow-sm")}>
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="flex flex-col leading-none" aria-label={`${siteConfig.shortName} home`}>
          <span className="font-display text-xl font-bold text-brand">{siteConfig.shortName}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Arizona Board for Certification</span>
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-semibold text-muted transition-colors hover:text-brand",
                  active && "text-brand",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href={accountHref} className="hidden text-sm font-semibold text-muted hover:text-brand md:inline">
            {accountLabel}
          </Link>
          <CtaButton href={HEADER_CTA.href} size="sm" className="hidden md:inline-flex">
            {HEADER_CTA.label}
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
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-base font-semibold text-ink hover:bg-line/60"
                >
                  {item.label}
                </Link>
              ))}
              <Link href={accountHref} className="rounded-lg px-3 py-2.5 text-base font-semibold text-ink hover:bg-line/60">
                {accountLabel}
              </Link>
            </nav>
            <CtaButton href={HEADER_CTA.href} className="mt-6 w-full">
              {HEADER_CTA.label}
            </CtaButton>
          </div>
        </div>
      )}
    </header>
  );
}
