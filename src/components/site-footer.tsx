import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";
import { BrandLogo } from "@/components/brand-logo";

const quickLinks = [
  { label: "Sync Your Certs", href: "/store/certification-sync" },
  { label: "Verify a Certification", href: "/verify" },
  { label: "Counselor Directory", href: "/directory" },
  { label: "FAQ", href: "/faq" },
  { label: "Blog", href: "/blog" },
];

export function SiteFooter() {
  const c = siteConfig.contact;
  return (
    <footer className="border-t-4 border-brand bg-info text-white">
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 sm:gap-10 sm:px-6 md:grid-cols-3 md:px-8 md:py-16">
        <div>
          <BrandLogo className="h-14 rounded-md" />
          <address className="mt-5 not-italic text-sm leading-7 text-white/65">
            {c.org}
            <br />
            {c.addressLine}
            <br />
            {c.cityStateZip}
            <br />
            <a href={c.phoneHref} className="transition-colors hover:text-white">{c.phone}</a>
            <br />
            <a href={c.emailHref} className="transition-colors hover:text-white">{c.email}</a>
          </address>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Our services</h4>
          <ul className="mt-4 space-y-1 text-sm text-white/65">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-[44px] items-center transition-colors hover:text-white sm:min-h-0">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="inline-flex rounded-xl bg-white px-4 py-3">
            <Image
              src="/brand/icrc-logo.png"
              alt="International Certification & Reciprocity Consortium (IC&RC)"
              width={120}
              height={41}
              className="h-9 w-auto"
            />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">{siteConfig.icrcLine}</p>
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/10">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-6 text-xs text-white/50 sm:px-6 md:px-8">{siteConfig.legal}</div>
      </div>
    </footer>
  );
}
