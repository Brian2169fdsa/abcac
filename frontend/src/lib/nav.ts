// Single source of truth for primary navigation (desktop + mobile).

export interface NavItem {
  label: string;
  href: string;
}

export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "CEU", href: "/ceu" },
  { label: "Choose Your Cert Path", href: "/choose-your-cert-path" },
  { label: "Initial Certification", href: "/initial-certification" },
  { label: "Certification Renewal", href: "/certification-renewal" },
  { label: "IC&RC", href: "/ic-rc" },
  { label: "Reciprocity", href: "/reciprocity" },
  { label: "Testing", href: "/testing" },
  { label: "Sync Your Certs", href: "/store/certification-sync" },
  { label: "Contact Us", href: "/contact" },
];

// Secondary CTA at the right of the header. Points to /contact until a booking
// URL is provided (logged in DECISIONS.md).
export const HEADER_CTA = { label: "Book an Audit", href: "/contact" };

// Primary entry to the member portal (the standalone portal app, co-hosted at
// /portal). Overridable via NEXT_PUBLIC_PORTAL_URL (e.g. a portal subdomain).
export const MEMBER_PORTAL = {
  label: "Member Portal",
  href: process.env.NEXT_PUBLIC_PORTAL_URL || "/portal",
};
