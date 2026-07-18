"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { HOME_LINK, MENU, MENU_LINKS, HEADER_CTA } from "@/lib/nav";
import { CtaButton } from "@/components/cta-button";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  onPortalOpen: () => void;
}

/**
 * Mobile mega-menu drawer (sub-xl). Renders the MENU groups as collapsible
 * accordions, the simple MENU_LINKS, and the Member Portal / Book an Audit
 * CTAs near the bottom. Desktop uses <MegaMenu /> instead.
 */
export function MobileNav({ open, onClose, onPortalOpen }: MobileNavProps) {
  const pathname = usePathname();
  // First group expanded by default; keeps the drawer feeling alive but tidy.
  const [expanded, setExpanded] = useState<number | null>(0);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-close when the viewport grows to xl — the drawer is `xl:hidden` and the
  // hamburger disappears there, so without this the body scroll lock would stick.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => mq.matches && onClose();
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
      <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <BrandLogo className="h-11 rounded" />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-line/60"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            <Link
              href={HOME_LINK.href}
              aria-current={pathname === HOME_LINK.href ? "page" : undefined}
              className={cn(
                "flex min-h-[48px] items-center rounded-lg px-3 text-base font-semibold transition-colors hover:bg-line/50 active:bg-line/70",
                pathname === HOME_LINK.href ? "bg-line/50 text-brand" : "text-ink",
              )}
            >
              {HOME_LINK.label}
            </Link>

            {MENU.map((group, i) => {
              const isOpen = expanded === i;
              const panelId = `mobile-group-${i}`;
              return (
                <div key={group.label} className="border-b border-line/70">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded(isOpen ? null : i)}
                    className="flex min-h-[52px] w-full items-center justify-between rounded-lg px-3 text-left text-sm font-bold uppercase tracking-wide text-accent-strong hover:bg-line/40"
                  >
                    {group.label}
                    <ChevronDown
                      className={cn("h-5 w-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>

                  <div
                    id={panelId}
                    hidden={!isOpen}
                    className="pb-2"
                  >
                    {group.links.map((link) => {
                      const external = link.href.startsWith("http");
                      const inner = (
                        <>
                          {link.image && (link.imagePosition ? (
                            <span
                              aria-hidden
                              className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-bg bg-no-repeat"
                              style={{
                                backgroundImage: `url(${link.image})`,
                                backgroundPosition: link.imagePosition,
                                backgroundSize: "300% 300%",
                              }}
                            />
                          ) : (
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-bg">
                              <Image src={link.image} alt="" fill sizes="44px" className="object-cover" />
                            </span>
                          ))}
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-ink">{link.label}</span>
                            {link.desc && <span className="mt-0.5 block text-xs text-muted">{link.desc}</span>}
                          </span>
                        </>
                      );
                      const cls =
                        "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-line/50 active:bg-line/70";
                      return external ? (
                        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={cls}>
                          {inner}
                        </a>
                      ) : (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={pathname === link.href ? "page" : undefined}
                          className={cls}
                        >
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Simple links */}
            <div className="mt-2 flex flex-col gap-1">
              {MENU_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="flex min-h-[48px] items-center rounded-lg px-3 text-base font-semibold text-ink transition-colors hover:bg-line/50 active:bg-line/70"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* Sticky CTAs near the bottom (thumb-reachable) */}
        <div className="border-t border-line bg-surface px-4 py-4">
          <Button type="button" className="w-full" onClick={onPortalOpen}>Member Portal</Button>
          <CtaButton href={HEADER_CTA.href} variant="outline" className="mt-3 w-full">
            {HEADER_CTA.label}
          </CtaButton>
        </div>
      </div>
    </div>
  );
}
