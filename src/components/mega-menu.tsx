"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ArrowRight } from "lucide-react";
import { HOME_LINK, MENU, MENU_LINKS } from "@/lib/nav";
import { BrandLogo } from "@/components/brand-logo";
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
    <div
      className="relative hidden items-center gap-0.5 rounded-2xl border border-info/[0.08] bg-surface p-1 shadow-[0_8px_28px_-22px_rgba(13,34,63,0.5)] xl:flex"
      onMouseLeave={() => setOpen(null)}
    >
      <Link
        href={HOME_LINK.href}
        aria-current={pathname === HOME_LINK.href ? "page" : undefined}
        className={cn(
          "rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
          pathname === HOME_LINK.href ? "bg-brand/[0.07] text-brand" : "text-muted hover:bg-bg hover:text-brand",
        )}
      >
        {HOME_LINK.label}
      </Link>

      {MENU.map((group, i) => (
        <div key={group.label} onMouseEnter={() => setOpen(i)}>
          <button
            type="button"
            aria-expanded={open === i}
            aria-haspopup="true"
            onClick={() => setOpen(open === i ? null : i)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
              open === i ? "bg-brand/[0.07] text-brand" : "text-muted hover:bg-bg hover:text-brand",
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
            "rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
            pathname === link.href ? "bg-brand/[0.07] text-brand" : "text-muted hover:bg-bg hover:text-brand",
          )}
        >
          {link.label}
        </Link>
      ))}

      {/* Dropdown panel */}
      {open !== null && (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-4">
          <div className="w-[850px] max-w-[92vw] overflow-hidden rounded-[1.75rem] border border-info/10 bg-white shadow-[0_36px_100px_-40px_rgba(13,34,63,0.55)] ring-1 ring-white">
            <div className="grid grid-cols-[255px_1fr]">
              {/* Branded featured block */}
              <Link href={MENU[open].featured.href} className="group relative isolate flex min-h-[390px] flex-col overflow-hidden bg-gradient-to-br from-info via-info to-brand-600 p-7 text-white">
                <div className="site-noise absolute inset-0 -z-10" aria-hidden />
                <div className="absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full border-[36px] border-white/[0.07]" aria-hidden />
                <div className="absolute -bottom-20 -left-14 -z-10 h-52 w-52 rounded-full bg-brand/55 blur-3xl" aria-hidden />
                <div className="mb-10 rounded-[1.35rem] border border-white/15 bg-white/[0.08] p-5 shadow-inner backdrop-blur">
                  <BrandLogo className="h-12 brightness-0 invert" />
                  <div className="mt-5 grid grid-cols-4 gap-1.5" aria-hidden>
                    {[0, 1, 2, 3].map((bar) => (
                      <span key={bar} className="h-1 rounded-full bg-white/25 transition-colors group-hover:bg-white/60" />
                    ))}
                  </div>
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">ABCAC pathways</p>
                <h3 className="text-2xl text-white">{MENU[open].featured.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/70">{MENU[open].featured.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white">
                  {MENU[open].featured.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>

              {/* Links grid */}
              <div className="grid grid-cols-2 gap-2 bg-white p-5">
                {MENU[open].links.map((link) => {
                  const external = link.href.startsWith("http");
                  const inner = (
                    <>
                      <div className="text-sm font-semibold text-ink transition-colors group-hover/link:text-brand">{link.label}</div>
                      {link.desc && <div className="mt-0.5 text-xs text-muted">{link.desc}</div>}
                      {link.image && (link.imagePosition ? (
                        <div
                          aria-hidden
                          className="mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-bg bg-no-repeat transition-transform duration-300 group-hover/link:scale-[1.02]"
                          style={{
                            backgroundImage: `url(${link.image})`,
                            backgroundPosition: link.imagePosition,
                            backgroundSize: "300% 300%",
                          }}
                        />
                      ) : (
                        <div className="relative mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-bg">
                          <Image src={link.image} alt="" fill sizes="240px" className="object-cover transition-transform duration-500 group-hover/link:scale-105" />
                        </div>
                      ))}
                    </>
                  );
                  const cls = "group/link rounded-2xl border border-transparent p-3.5 transition-all hover:border-brand/10 hover:bg-brand/[0.035] hover:shadow-[0_16px_35px_-28px_rgba(13,34,63,0.45)]";
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
