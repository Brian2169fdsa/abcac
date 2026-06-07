// Single source of truth for primary navigation (desktop + mobile).

export interface NavItem {
  label: string;
  href: string;
}

// Secondary CTA at the right of the header. Points to /contact until a booking
// URL is provided (logged in DECISIONS.md).
export const HEADER_CTA = { label: "Book an Audit", href: "/contact" };

// ─── Mega menu (desktop dropdowns + mobile accordion) ───
export interface MenuLink {
  label: string;
  href: string;
  desc?: string;
  image?: string;
}
export interface MegaGroup {
  label: string;
  featured: { image: string; title: string; text: string; href: string; cta: string };
  links: MenuLink[];
}

export const MENU: MegaGroup[] = [
  {
    label: "Certification",
    featured: {
      image: "/brand/cadac-certificate.png",
      title: "Start your certification",
      text: "Find the credential that fits your career and apply online through our secure portal.",
      href: "/choose-your-cert-path",
      cta: "Choose Your Path",
    },
    links: [
      { label: "Choose Your Cert Path", href: "/choose-your-cert-path", desc: "Not sure where to start? Find your path.", image: "/brand/menu/choose-path.png" },
      { label: "Initial Certification", href: "/initial-certification", desc: "Apply for your first ABCAC credential.", image: "/brand/menu/int-cert.png" },
      { label: "Certification Renewal", href: "/certification-renewal", desc: "Renew every two years with your CEUs.", image: "/brand/menu/renewal.png" },
    ],
  },
  {
    label: "Exams & IC&RC",
    featured: {
      image: "/brand/menu/exams.png",
      title: "IC&RC testing",
      text: "Computer-based IC&RC exams, in person at an Arizona center or remote-proctored.",
      href: "/testing",
      cta: "Register to Test",
    },
    links: [
      { label: "Testing", href: "/testing", desc: "Register for your IC&RC / AZBBHE exam." },
      { label: "Remote or In-Person", href: "/remote-or-inperson", desc: "Compare exam delivery options." },
      { label: "About IC&RC", href: "https://internationalcredentialing.org", desc: "Visit the IC&RC website." },
      { label: "Reciprocity", href: "/reciprocity", desc: "Transfer your credential to or from Arizona." },
    ],
  },
  {
    label: "CEU & Store",
    featured: {
      image: "/brand/menu/ceu.svg",
      title: "Sync your certifications",
      text: "One unified renewal date for all your credentials — just $15/month forward.",
      href: "/store/certification-sync",
      cta: "Start Your Sync",
    },
    links: [
      { label: "CEU Endorsement", href: "/ceu", desc: "Provider fees and workshop endorsement tiers." },
      { label: "Sync Your Certs", href: "/store/certification-sync", desc: "Align your renewal dates." },
      { label: "Store", href: "/store", desc: "All certification & exam payments." },
      { label: "FAQ", href: "/faq", desc: "Answers to common questions." },
    ],
  },
];

// Simple top-level links shown alongside the mega groups.
export const MENU_LINKS: MenuLink[] = [
  { label: "Store", href: "/store" },
  { label: "Contact", href: "/contact" },
];

// Single source of truth for primary navigation (legacy flat list, mobile fallback).
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

// Primary entry to the member portal. Points to the standalone member portal
// page (/portal), which works on its own without extra configuration. Plain
// link — no dropdown/submenu.
export const MEMBER_PORTAL = {
  label: "Member Portal",
  href: "/portal",
};
