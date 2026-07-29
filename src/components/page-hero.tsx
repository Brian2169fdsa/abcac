import { BadgeCheck, CheckCircle2, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface PageHeroProps {
  title: string;
  intro?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

/** Shared hero for interior pages — homepage design language: a soft brand
 *  gradient wash, a pill eyebrow chip, and large navy display type. */
export function PageHero({ title, intro, eyebrow, children }: PageHeroProps) {
  return (
    <div className="relative isolate overflow-hidden border-b border-line bg-surface">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-surface via-surface to-brand/[0.07]" aria-hidden />
      <div className="site-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div className="absolute -right-48 -top-52 -z-10 h-[34rem] w-[34rem] rounded-full border-[74px] border-brand/[0.045]" aria-hidden />
      <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.72fr] lg:gap-16 lg:px-12 lg:py-24 xl:px-16">
        <div>
          {eyebrow && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-surface/75 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {eyebrow}
            </p>
          )}
          <h1 className="max-w-4xl text-[clamp(2.65rem,5vw,4.6rem)]">{title}</h1>
          {intro && <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{intro}</p>}
          {children && <div className="mt-7">{children}</div>}
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full border-[8px] border-brand/10" aria-hidden />
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-info via-info to-brand-600 p-7 text-white shadow-[0_34px_90px_-42px_rgba(13,34,63,0.75)]">
            <div className="site-noise absolute inset-0" aria-hidden />
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full border-[32px] border-white/[0.055]" aria-hidden />
            <div className="relative">
              <BrandLogo className="h-12 brightness-0 invert" />
              <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white/50">Your credential journey</p>
              <div className="mt-4 space-y-3">
                {["Apply with confidence", "Track your progress", "Maintain your credential"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs font-bold text-white/70">0{index + 1}</span>
                    <span className="text-sm font-semibold text-white">{item}</span>
                    <CheckCircle2 className="ml-auto h-4 w-4 text-white/45" aria-hidden />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                <BadgeCheck className="h-5 w-5 text-white/60" aria-hidden />
                <p className="text-xs leading-relaxed text-white/60">Arizona based. IC&amp;RC recognized. Built for professionals.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
