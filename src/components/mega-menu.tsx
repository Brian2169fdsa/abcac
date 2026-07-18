"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ArrowRight } from "lucide-react";
import { MENU, MENU_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MegaMenu() {
  const [open, setOpen] = useState<number | null>(null);
  const pathname = usePathname();

  // Close on navigation or Escape.
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative hidden items-center gap-1.5 xl:flex" onMouseLeave={() => setOpen(null)}>
      {MENU.map((group, i) => (
        <div key={group.label} onMouseEnter={() => setOpen(i)}>
          <button
            type="button"
            aria-expanded={open === i}
            aria-haspopup="true"
            onClick={() => setOpen(open === i ? null : i)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors",
              open === i ? "text-brand" : "text-muted hover:text-brand",
            )}
          >
            {group.label}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open === i && "rotate-180")} aria-hidden />
          </button>
        </div>
      ))}

      {MENU_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors",
            pathname === link.href ? "text-brand" : "text-muted hover:text-brand",
          )}
        >
          {link.label}
        </Link>
      ))}

      {/* Dropdown panel */}
      {open !== null && (
        <div className="absolute left-0 top-full z-50 pt-3">
          <div className="w-[780px] max-w-[92vw] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <div className="grid grid-cols-[260px_1fr]">
              {/* Featured image block */}
              <Link href={MENU[open].featured.href} className="group relative flex flex-col bg-brand p-6 text-white">
                <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-white/10">
                  <Image
                    src={MENU[open].featured.image}
                    alt=""
                    fill
                    sizes="260px"
                    className="object-cover"
                  />
                </div>
                <h3 className="text-white">{MENU[open].featured.title}</h3>
                <p className="mt-1 flex-1 text-sm text-white/80">{MENU[open].featured.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  {MENU[open].featured.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>

              {/* Links grid */}
              <div className="grid grid-cols-2 gap-1 p-4">
                {MENU[open].links.map((link) => {
                  const external = link.href.startsWith("http");
                  const inner = (
                    <>
                      <div className="text-sm font-semibold text-ink">{link.label}</div>
                      {link.desc && <div className="mt-0.5 text-xs text-muted">{link.desc}</div>}
                      {link.image && (
                        <div className="relative mt-2 aspect-[16/9] overflow-hidden rounded-md border border-line bg-bg">
                          <Image src={link.image} alt="" fill sizes="240px" className="object-cover" />
                        </div>
                      )}
                    </>
                  );
                  const cls = "rounded-lg p-3 transition-colors hover:bg-bg";
                  return external ? (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={link.href} href={link.href} className={cls}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
