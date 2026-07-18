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
  imagePosition?: string;
}
export interface MegaGroup {
  label: string;
  featured: { title: string; text: string; href: string; cta: string };
  links: MenuLink[];
}

export const MENU: MegaGroup[] = [
  {
    label: "Certification",
    featured: {
      title: "Initial or renewal",
      text: "Apply for your first ABCAC credential or keep your current certification active.",
      href: "/initial-certification",
      cta: "Initial Certification",
    },
    links: [
      { label: "Initial Certification", href: "/initial-certification", desc: "Apply for your first ABCAC credential.", image: "/brand/menu/int-cert.png" },
      { label: "Certification Renewal", href: "/certification-renewal", desc: "Renew every two years with your CEUs.", image: "/brand/menu/renewal.png" },
    ],
  },
  {
    label: "Exams & IC&RC",
    featured: {
      title: "IC&RC testing",
      text: "Computer-based IC&RC exams, in person at an Arizona center or remote-proctored.",
      href: "/testing",
      cta: "Register to Test",
    },
    links: [
      { label: "Testing", href: "/testing", desc: "Register for your IC&RC / AZBBHE exam.", image: "/brand/menu/services-atlas.png", imagePosition: "0% 0%" },
      { label: "Remote or In-Person", href: "/remote-or-inperson", desc: "Compare exam delivery options.", image: "/brand/menu/services-atlas.png", imagePosition: "50% 0%" },
      { label: "About IC&RC", href: "/ic-rc", desc: "Learn about international credentialing.", image: "/brand/menu/services-atlas.png", imagePosition: "100% 0%" },
      { label: "Reciprocity", href: "/reciprocity", desc: "Transfer your credential to or from Arizona.", image: "/brand/menu/services-atlas.png", imagePosition: "0% 50%" },
    ],
  },
  {
    label: "CEU & Store",
    featured: {
      title: "Sync your certifications",
      text: "Move multiple ABCAC credentials to one unified renewal date with one clear request.",
      href: "/certification-sync",
      cta: "Explore Certification Sync",
    },
    links: [
      { label: "CEU Endorsement", href: "/ceu", desc: "Provider fees and workshop endorsement tiers.", image: "/brand/menu/services-atlas.png", imagePosition: "50% 50%" },
      { label: "Sync Your Certs", href: "/certification-sync", desc: "Align your renewal dates.", image: "/brand/menu/services-atlas.png", imagePosition: "100% 50%" },
      { label: "Store", href: "/store", desc: "All certification & exam payments.", image: "/brand/menu/services-atlas.png", imagePosition: "0% 100%" },
      { label: "Counselor Directory", href: "/directory", desc: "Browse certified counselors in good standing.", image: "/brand/menu/services-atlas.png", imagePosition: "50% 100%" },
      { label: "FAQ", href: "/faq", desc: "Answers to common questions.", image: "/brand/menu/services-atlas.png", imagePosition: "100% 100%" },
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
  { label: "Initial Certification", href: "/initial-certification" },
  { label: "Certification Renewal", href: "/certification-renewal" },
  { label: "IC&RC", href: "/ic-rc" },
  { label: "Reciprocity", href: "/reciprocity" },
  { label: "Testing", href: "/testing" },
  { label: "Sync Your Certs", href: "/certification-sync" },
  { label: "Contact Us", href: "/contact" },
];
