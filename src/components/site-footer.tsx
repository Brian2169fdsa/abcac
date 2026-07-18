import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

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
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-content grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:gap-10 sm:px-5 md:grid-cols-3 md:px-8 md:py-14">
        <div>
          <div className="font-display text-lg font-bold text-brand">{siteConfig.shortName}</div>
          <address className="mt-3 not-italic text-sm text-muted">
            {c.org}
            <br />
            {c.addressLine}
            <br />
            {c.cityStateZip}
            <br />
            <a href={c.phoneHref} className="hover:text-brand">{c.phone}</a>
            <br />
            <a href={c.emailHref} className="hover:text-brand">{c.email}</a>
          </address>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-ink">Our services</h4>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-[44px] items-center hover:text-brand sm:min-h-0">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Image
            src="/brand/icrc-logo.png"
            alt="International Certification & Reciprocity Consortium (IC&RC)"
            width={120}
            height={41}
            className="h-9 w-auto"
          />
          <p className="mt-3 text-sm text-muted">{siteConfig.icrcLine}</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto w-full max-w-content px-4 py-6 text-xs text-muted sm:px-5 md:px-8">{siteConfig.legal}</div>
      </div>
    </footer>
  );
}
