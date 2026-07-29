import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { BrandLogo } from "@/components/brand-logo";
import { CtaButton } from "@/components/cta-button";

const quickLinks = [
  { label: "Sync Your Certs", href: "/certification-sync" },
  { label: "Verify a Certification", href: "/verify" },
  { label: "Counselor Directory", href: "/directory" },
  { label: "FAQ", href: "/faq" },
  { label: "Blog", href: "/blog" },
];

export function SiteFooter() {
  const c = siteConfig.contact;
  return (
    <footer className="relative isolate overflow-hidden border-t-4 border-brand bg-info text-white">
      <div className="site-noise absolute inset-0 -z-20" aria-hidden />
      <div className="absolute -right-52 -top-52 -z-10 h-[32rem] w-[32rem] rounded-full border-[72px] border-white/[0.035]" aria-hidden />

      <div className="mx-auto w-full max-w-[90rem] px-5 pt-14 sm:px-8 sm:pt-16 lg:px-12">
        <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 shadow-[0_28px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Move your career forward</p>
            <h2 className="mt-3 max-w-2xl text-3xl text-white sm:text-4xl">Ready for your next ABCAC credential step?</h2>
            <p className="mt-4 max-w-2xl text-white/60">Start an application, renew your certification, or sign in to manage work already in progress.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <CtaButton href="/account" size="lg" className="bg-white text-brand hover:bg-white/90">
              Open Member Portal <ArrowRight className="h-4 w-4" aria-hidden />
            </CtaButton>
            <CtaButton href="/initial-certification" variant="outline" size="lg" className="border-white/25 bg-transparent text-white hover:border-white hover:bg-white hover:text-info">
              Explore Certification
            </CtaButton>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-10 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-12 lg:px-12 lg:py-16">
        <div className="lg:col-span-4">
          <BrandLogo className="h-12 brightness-0 invert" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Setting the standard for addiction counselor certification, testing, and professional mobility in Arizona.
          </p>
          <address className="mt-6 space-y-3 not-italic text-sm text-white/65">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/35" aria-hidden />
              <span>{c.addressLine}<br />{c.cityStateZip}</span>
            </div>
            <a href={c.phoneHref} className="flex items-center gap-3 transition-colors hover:text-white">
              <Phone className="h-4 w-4 text-white/35" aria-hidden /> {c.phone}
            </a>
            <a href={c.emailHref} className="flex items-center gap-3 transition-colors hover:text-white">
              <Mail className="h-4 w-4 text-white/35" aria-hidden /> {c.email}
            </a>
          </address>
        </div>

        <div className="lg:col-span-3 lg:col-start-6">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Quick links</h4>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-white/65 sm:grid-cols-1">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group inline-flex min-h-[40px] items-center gap-2 transition-colors hover:text-white">
                  <span className="h-1 w-1 rounded-full bg-brand transition-transform group-hover:scale-150" aria-hidden />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4 lg:col-start-10">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg">
            <Image
              src="/brand/icrc-logo.png"
              alt="International Certification & Reciprocity Consortium (IC&RC)"
              width={120}
              height={41}
              className="h-9 w-auto"
            />
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">{siteConfig.icrcLine}</p>
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/10">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 px-4 py-6 text-xs text-white/50 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
          <span>{siteConfig.legal}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/code-of-ethics" className="transition-colors hover:text-white">Code of Ethics</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
